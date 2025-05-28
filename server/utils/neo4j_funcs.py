import os
import re
import math
import neo4j
from rapidfuzz import fuzz
from unidecode import unidecode
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USER = os.getenv("NEO4J_USER")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

SIMILAR_ADDRESS_CYPHER_QUERY = """
    MATCH (i:Intersection)
    WHERE i.address IS NOT NULL
    RETURN DISTINCT i.address as address
"""

A_STAR_STEP_BY_STEP_CYPHER_QUERY = """ MATCH (start:Intersection {address: $start_address})
WITH start LIMIT 1
MATCH (end:Intersection {address: $end_address})    
WITH start, end LIMIT 1

// Calcular las coordenadas del destino para usar en la heurística
WITH start, end, 
     point.distance(start.location, end.location) AS straightLineDistance

// Buscar caminos usando shortestPath
MATCH p = shortestPath((start)-[:ROAD_SEGMENT*]->(end))
WHERE all(r IN relationships(p) WHERE r.length IS NOT NULL)

// Calcular distancia real total
WITH p, start, end, straightLineDistance,
     reduce(total = 0, r IN relationships(p) | total + r.length) AS actualDistance

// Ordenar primero por distancia (como haría A*)
ORDER BY actualDistance ASC
LIMIT 1

WITH p, nodes(p) AS nodes, relationships(p) AS rels, actualDistance
UNWIND range(0, size(rels)-1) AS i

// Calcular distancia en línea recta desde cada nodo al destino (heurística A*)
WITH p, nodes, rels, i, actualDistance,
     point.distance(nodes[i].location, nodes[size(nodes)-1].location) AS heuristicToDestination

RETURN 
    i + 1 AS paso,
    nodes[i].address AS desde,
    nodes[i+1].address AS hasta,
    rels[i].name AS nombreCalle,
    rels[i].highway AS tipoCalle,
    CASE WHEN rels[i].oneway = true THEN 'Sí' ELSE 'No' END AS unidireccional,
    rels[i].length AS distancia_metros,
    heuristicToDestination AS distanciaLineaRectaAlDestino,
    rels[i].max_speed AS velocidadMaxima_kmh,
    CASE 
        WHEN i = 0 THEN 'Inicio' 
        WHEN i = size(rels)-1 THEN 'Destino' 
        ELSE 'Continuar por' 
    END AS instruccion,
    CASE WHEN i = 0 THEN actualDistance ELSE null END AS distanciaTotal
ORDER BY paso;
"""

class Neo4jController:
    def __init__(self):
        self.driver = neo4j.GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    
    def normalize_text(self, text):
        return unidecode(text.lower().strip())

    def find_similar_address(self, address, limit=5, min_similarity=90):
        normalized_input = self.normalize_text(address)

        number_match = re.search(r'\d+', normalized_input)
        has_number = bool(number_match)
        input_number = number_match.group() if has_number else None

        with self.driver.session() as session:
            result = session.run(SIMILAR_ADDRESS_CYPHER_QUERY)
            addresses = [record["address"] for record in result]

        matches = []
        for db_address in addresses:
            if not db_address:
                continue
            
            normalized_db = self.normalize_text(db_address)

            number_matches = True
            if has_number and input_number not in normalized_db:
                number_matches = False

            # Calculate multiple similarity metrics
            simple_ratio = fuzz.ratio(normalized_input, normalized_db)
            partial_ratio = fuzz.partial_ratio(normalized_input, normalized_db)
            token_sort_ratio = fuzz.token_sort_ratio(normalized_input, normalized_db)
            
            score_boost = 30 if number_matches else 0
            score = max(simple_ratio, partial_ratio, token_sort_ratio) + score_boost
            
            if score >= min_similarity:
                matches.append({
                    "address": db_address,
                    "similarity_score": score,
                    "normalized_input": normalized_input,
                    "normalized_db": normalized_db
                })
        
        # Sort by score (highest first) and take top matches
        matches.sort(key=lambda x: x["similarity_score"], reverse=True)
        
        return matches[:limit]


    def clean_nan(self, value):
        if isinstance(value, float) and math.isnan(value):
            return None
        return value

    def find_shortest_path(self, start_location, end_location):
        start_location_match = self.find_similar_address(start_location, limit=1)
        end_location_match = self.find_similar_address(end_location, limit=1)

        if not start_location_match or not end_location_match:
            raise ValueError("Could not find matching addresses for the provided locations")

        start_address = start_location_match[0]["address"]
        end_address = end_location_match[0]["address"]

        print(f"Start location: {start_address}")
        print(f"End location: {end_address}")
        
        with self.driver.session() as session:
            result = session.run(
                A_STAR_STEP_BY_STEP_CYPHER_QUERY, 
                start_address=start_address, 
                end_address=end_address
            )

            # Consume all records at once
            records = [dict(record) for record in result]
            
            # Clean up the records
            clean_records = []
            for record in records:
                clean_record = {}
                for key, value in record.items():
                    if value is not None:
                        if hasattr(value, 'items'):
                            clean_record[key] = {k: self.clean_nan(v) for k, v in value.items()}
                        else:
                            clean_record[key] = self.clean_nan(value)
                    else:
                        clean_record[key] = None
                clean_records.append(clean_record)
       

        return clean_records
