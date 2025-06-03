import os
import re
import math
import neo4j
import json
from pathlib import Path
from rapidfuzz import fuzz
from unidecode import unidecode
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USER = os.getenv("NEO4J_USER")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

HOPSITALS_JSON_PATHS = Path(__file__).parent.parent.parent / "data" / "clinicas.json"


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
    rels[i].osmid AS OSMID,
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
        self.hospitals = json.loads(HOPSITALS_JSON_PATHS.read_text())
    
    def normalize_text(self, text):
        return unidecode(text.lower().strip())
        
    def clean_nan(self, value):
        if isinstance(value, float) and math.isnan(value):
            return None
        return value

    def find_similar_address(self, address, limit=5, min_similarity=90):
        normalized_input = self.normalize_text(address)

        number_match = re.search(r'\d+', normalized_input)
        has_number = bool(number_match)
        input_number = number_match.group() if has_number else None

        # Obtener candidatos particionados en lugar de todas las direcciones
        candidate_partitions = self._get_partitioned_candidates(normalized_input, input_number)
        
        # Procesar particiones en paralelo si hay suficientes candidatos
        total_candidates = sum(len(addresses) for addresses in candidate_partitions.values())
        
        if total_candidates > 500:  # Paralelizar solo si vale la pena
            matches = self._process_partitions_parallel(
                candidate_partitions, normalized_input, has_number, input_number, min_similarity
            )
        else:
            matches = self._process_partitions_sequential(
                candidate_partitions, normalized_input, has_number, input_number, min_similarity
            )
        
        # Sort by score (highest first) and take top matches
        matches.sort(key=lambda x: x["similarity_score"], reverse=True)
        return matches[:limit]

    def _get_partitioned_candidates(self, normalized_input, input_number):
        partitions = {
            'exact_number': [],
            'number_range': [],
            'text_match': [],
            'fallback': []
        }

        with self.driver.session() as session:
            # Partición 1: Coincidencia exacta de número (más prioritaria)
            if input_number:
                result = session.run("""
                    MATCH (i:Intersection)
                    WHERE i.address CONTAINS $number_str
                    RETURN i.address as address
                    LIMIT 300
                """, number_str=str(input_number))
                partitions['exact_number'] = [record["address"] for record in result if record["address"]]

            # Partición 2: Rango de números cercanos
            if input_number:
                target_num = int(input_number)
                result = session.run("""
                    MATCH (i:Intersection)
                    WHERE i.address =~ '.*\\\\d+.*'
                    WITH i, [x IN split(i.address, ' ') WHERE x =~ '\\\\d+' | toInteger(x)][0] as addr_num
                    WHERE addr_num IS NOT NULL 
                          AND abs(addr_num - $target_num) <= 100
                          AND abs(addr_num - $target_num) > 0
                    RETURN i.address as address
                    LIMIT 800
                """, target_num=target_num)
                partitions['number_range'] = [record["address"] for record in result if record["address"]]

            # Partición 3: Coincidencias de texto (primeras palabras)
            first_words = normalized_input.split()[:2]
            if len(first_words) >= 1:
                result = session.run("""
                    MATCH (i:Intersection)
                    WHERE toLower(i.address) CONTAINS $first_word
                    RETURN i.address as address
                    LIMIT 1000
                """, first_word=first_words[0])
                partitions['text_match'] = [record["address"] for record in result if record["address"]]

            # Partición 4: Fallback - muestra más grande si no hay suficientes candidatos
            total_so_far = sum(len(addrs) for addrs in partitions.values())
            if total_so_far < 200:
                result = session.run("""
                    MATCH (i:Intersection)
                    RETURN i.address as address
                    ORDER BY rand()
                    LIMIT 2000
                """)
                partitions['fallback'] = [record["address"] for record in result if record["address"]]
        
        return self._remove_duplicates_between_partitions(partitions)

    def _remove_duplicates_between_partitions(self, partitions):
        seen = set()
        cleaned_partitions = {}
        
        priority_order = ['exact_number', 'number_range', 'text_match', 'fallback']
        
        for partition_name in priority_order:
            if partition_name in partitions:
                unique_addresses = []
                for addr in partitions[partition_name]:
                    if addr and addr not in seen:
                        unique_addresses.append(addr)
                        seen.add(addr)
                cleaned_partitions[partition_name] = unique_addresses
        
        return cleaned_partitions

    def _process_partitions_parallel(self, partitions, normalized_input, has_number, input_number, min_similarity):
        all_matches = []
        
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = []
            
            for partition_name, addresses in partitions.items():
                if addresses:  # Solo procesar particiones no vacías
                    future = executor.submit(
                        self._process_single_partition,
                        addresses, normalized_input, has_number, input_number, 
                        min_similarity, partition_name
                    )
                    futures.append(future)
            
            # Recolectar resultados
            for future in futures:
                partition_matches = future.result()
                all_matches.extend(partition_matches)
        
        return all_matches

    def _process_partitions_sequential(self, partitions, normalized_input, has_number, input_number, min_similarity):
        all_matches = []
        
        for partition_name, addresses in partitions.items():
            if addresses:
                partition_matches = self._process_single_partition(
                    addresses, normalized_input, has_number, input_number,
                    min_similarity, partition_name
                )
                all_matches.extend(partition_matches)
        
        return all_matches

    def _process_single_partition(self, addresses, normalized_input, has_number, input_number, min_similarity, partition_name):
        matches = []
        
        partition_adjustments = {
            'exact_number': -5,  # Más permisivo si coincide el número exacto
            'number_range': -5,   # Ligeramente más permisivo
            'text_match': 0,      # Umbral normal
            'fallback': +5        # Más estricto para direcciones aleatorias
        }
        
        adjusted_min_similarity = min_similarity + partition_adjustments.get(partition_name, 0)
        
        for db_address in addresses:
            if not db_address:
                continue
            
            normalized_db = self.normalize_text(db_address)

            number_matches = True
            if has_number and input_number not in normalized_db:
                number_matches = False

            if partition_name in ['exact_number', 'number_range']:
                score = fuzz.token_sort_ratio(normalized_input, normalized_db)

                if score < adjusted_min_similarity:
                    simple_ratio = fuzz.ratio(normalized_input, normalized_db)
                    partial_ratio = fuzz.partial_ratio(normalized_input, normalized_db)
                    score = max(score, simple_ratio, partial_ratio)
            else:
                simple_ratio = fuzz.ratio(normalized_input, normalized_db)
                partial_ratio = fuzz.partial_ratio(normalized_input, normalized_db)
                token_sort_ratio = fuzz.token_sort_ratio(normalized_input, normalized_db)
                score = max(simple_ratio, partial_ratio, token_sort_ratio)
            
            score_boost = 30 if number_matches else 0
            
            partition_boost = {
                'exact_number': 15,
                'number_range': 8,
                'text_match': 3,
                'fallback': 0
            }
            
            final_score = score + score_boost + partition_boost.get(partition_name, 0)
            
            if final_score >= adjusted_min_similarity:
                matches.append({
                    "address": db_address,
                    "similarity_score": min(final_score, 100),
                    "normalized_input": normalized_input,
                    "normalized_db": normalized_db,
                    "partition": partition_name
                })
        
        return matches
        
    def __init_case_sensitive(self):
        self.case_insensitive_map = {
            name.lower(): address for name, address in self.hospitals.items()
        }

    def get_address_from_hospital(self, hospital):
        if not hasattr(self, 'case_insensitive_map'):
            self.__init_case_sensitive()
        return self.case_insensitive_map.get(hospital.lower())

    def find_shortest_path(self, start_location, end_location):
        start_address = self.get_address_from_hospital(start_location)
        end_address = self.get_address_from_hospital(end_location)

        if start_address is None:
            start_location_match = self.find_similar_address(start_location, limit=1)
            start_address = start_location_match[0]["address"]

        if end_address is None:
            end_location_match = self.find_similar_address(end_location, limit=1)
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
