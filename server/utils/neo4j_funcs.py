import os
import re
import math
import neo4j
import json
from pathlib import Path
from rapidfuzz import fuzz
from unidecode import unidecode
from dotenv import load_dotenv
from .trafficDetails import calculate_approx_time
from concurrent.futures import ThreadPoolExecutor

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USER = os.getenv("NEO4J_USER")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

HOPSITALS_JSON_PATHS = Path(__file__).parent.parent.parent / "data" / "clinicas.json"


BELLMAN_FORD_STEP_BY_STEP_CYPHER_QUERY = """
MATCH (start:Intersection {address: $start_address})
WITH start LIMIT 1
MATCH (end:Intersection {address: $end_address})    
WITH start, end LIMIT 1

// Define traffic multipliers based on time and road type
WITH start, end, 
    $current_hour as hour, 
    $day_type as dayType,
    CASE 
        WHEN $day_type = 'weekday' AND $current_hour IN [7, 8, 9] THEN 1.8        // Morning rush
        WHEN $day_type = 'weekday' AND $current_hour IN [17, 18, 19] THEN 2.0     // Evening rush  
        WHEN $day_type = 'weekday' AND $current_hour IN [10,11,12,13,14,15,16] THEN 1.2  // Midday
        WHEN $day_type = 'weekday' THEN 0.9                              // Low traffic hours
        WHEN $day_type = 'weekend' AND $current_hour IN [10,11,12,13,14,15,16] THEN 1.3  // Weekend moderate
        ELSE 0.8                                                       // Weekend low traffic
    END as timeMultiplier,
    {primary: 2.0, secondary: 1.5, residential: 0.8, tertiary: 1.2, trunk: 2.2, motorway: 1.8} as roadTypeMultipliers

// Find multiple path options using different strategies
// Strategy 1: Residential roads only
OPTIONAL MATCH p1 = shortestPath((start)-[:ROAD_SEGMENT*]-(end))
WHERE all(r IN relationships(p1) WHERE r.length IS NOT NULL AND r.highway = 'residential')

// Strategy 2: Residential and secondary roads
OPTIONAL MATCH p2 = shortestPath((start)-[:ROAD_SEGMENT*]-(end))
WHERE all(r IN relationships(p2) WHERE r.length IS NOT NULL AND r.highway IN ['residential', 'secondary'])

// Strategy 3: All roads (shortest distance)
OPTIONAL MATCH p3 = shortestPath((start)-[:ROAD_SEGMENT*]-(end))
WHERE all(r IN relationships(p3) WHERE r.length IS NOT NULL)

// Strategy 4: Avoid high-traffic roads during rush hours
OPTIONAL MATCH p4 = shortestPath((start)-[:ROAD_SEGMENT*]-(end))
WHERE all(r IN relationships(p4) WHERE 
    r.length IS NOT NULL AND 
    NOT (r.highway IN ['trunk', 'primary', 'motorway'] AND timeMultiplier > 1.5)
)

// Calculate actual distances for each path
WITH p1, p2, p3, p4, timeMultiplier, roadTypeMultipliers,
    CASE WHEN p1 IS NOT NULL THEN reduce(d = 0, r IN relationships(p1) | d + r.length) ELSE null END AS d1,
    CASE WHEN p2 IS NOT NULL THEN reduce(d = 0, r IN relationships(p2) | d + r.length) ELSE null END AS d2,
    CASE WHEN p3 IS NOT NULL THEN reduce(d = 0, r IN relationships(p3) | d + r.length) ELSE null END AS d3,
    CASE WHEN p4 IS NOT NULL THEN reduce(d = 0, r IN relationships(p4) | d + r.length) ELSE null END AS d4

// Calculate traffic-aware weights for each path
WITH p1, p2, p3, p4, d1, d2, d3, d4, timeMultiplier, roadTypeMultipliers,
    CASE WHEN p1 IS NOT NULL THEN reduce(tw = 0, r IN relationships(p1) | 
        tw + (r.length * timeMultiplier * COALESCE(roadTypeMultipliers[r.highway], 1.0))) ELSE null END AS tw1,
    CASE WHEN p2 IS NOT NULL THEN reduce(tw = 0, r IN relationships(p2) | 
        tw + (r.length * timeMultiplier * COALESCE(roadTypeMultipliers[r.highway], 1.0))) ELSE null END AS tw2,
    CASE WHEN p3 IS NOT NULL THEN reduce(tw = 0, r IN relationships(p3) | 
        tw + (r.length * timeMultiplier * COALESCE(roadTypeMultipliers[r.highway], 1.0))) ELSE null END AS tw3,
    CASE WHEN p4 IS NOT NULL THEN reduce(tw = 0, r IN relationships(p4) | 
        tw + (r.length * timeMultiplier * COALESCE(roadTypeMultipliers[r.highway], 1.0))) ELSE null END AS tw4

// Select the best path based on traffic-aware weight
WITH CASE 
    // Find the path with minimum traffic weight
    WHEN tw1 IS NOT NULL AND (tw2 IS NULL OR tw1 <= tw2) AND (tw3 IS NULL OR tw1 <= tw3) AND (tw4 IS NULL OR tw1 <= tw4) THEN p1
    WHEN tw2 IS NOT NULL AND (tw3 IS NULL OR tw2 <= tw3) AND (tw4 IS NULL OR tw2 <= tw4) THEN p2
    WHEN tw3 IS NOT NULL AND (tw4 IS NULL OR tw3 <= tw4) THEN p3
    WHEN tw4 IS NOT NULL THEN p4
    ELSE p3  // Fallback to basic shortest path
END as selectedPath,
CASE 
    WHEN tw1 IS NOT NULL AND (tw2 IS NULL OR tw1 <= tw2) AND (tw3 IS NULL OR tw1 <= tw3) AND (tw4 IS NULL OR tw1 <= tw4) 
        THEN 'Solo calles residenciales (óptima para tráfico)'
    WHEN tw2 IS NOT NULL AND (tw3 IS NULL OR tw2 <= tw3) AND (tw4 IS NULL OR tw2 <= tw4) 
        THEN 'Calles residenciales y secundarias (balanceada)'
    WHEN tw3 IS NOT NULL AND (tw4 IS NULL OR tw3 <= tw4) 
        THEN 'Todas las calles (ruta más corta)'
    WHEN tw4 IS NOT NULL 
        THEN 'Evitando calles de alto tráfico'
    ELSE 'Ruta básica más corta'
END as estrategiaUsada,
// Keep the best traffic weight for reporting
CASE 
    WHEN tw1 IS NOT NULL AND (tw2 IS NULL OR tw1 <= tw2) AND (tw3 IS NULL OR tw1 <= tw3) AND (tw4 IS NULL OR tw1 <= tw4) THEN tw1
    WHEN tw2 IS NOT NULL AND (tw3 IS NULL OR tw2 <= tw3) AND (tw4 IS NULL OR tw2 <= tw4) THEN tw2
    WHEN tw3 IS NOT NULL AND (tw4 IS NULL OR tw3 <= tw4) THEN tw3
    WHEN tw4 IS NOT NULL THEN tw4
    ELSE tw3
END as bestTrafficWeight

WHERE selectedPath IS NOT NULL

WITH selectedPath as p, estrategiaUsada, bestTrafficWeight,
    nodes(selectedPath) AS nodes, 
    relationships(selectedPath) AS rels,
    reduce(actualDistance = 0, r IN relationships(selectedPath) | actualDistance + r.length) AS totalDistance

UNWIND range(0, size(rels)-1) AS i

WITH p, nodes, rels, i, totalDistance, estrategiaUsada, bestTrafficWeight,
    point.distance(nodes[i].location, nodes[size(nodes)-1].location) AS heuristicToDestination

RETURN 
    i + 1 AS paso,
    nodes[i].address AS desde,
    nodes[i+1].address AS hasta,
    nodes[i].location.y AS fromLat,
    nodes[i].location.x AS fromLng,
    nodes[i+1].location.y AS toLat,
    nodes[i+1].location.x AS toLng,
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
    totalDistance AS distanciaTotal,
    estrategiaUsada AS estrategiaDeRuta,
    bestTrafficWeight AS pesoTotalTrafico
ORDER BY paso;
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
    nodes[i].location.y AS fromLat,
    nodes[i].location.x AS fromLng,
    nodes[i+1].location.y AS toLat,
    nodes[i+1].location.x AS toLng,
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
        self.hospitals = json.loads(HOPSITALS_JSON_PATHS.read_text())
    
    def normalize_text(self, text):
        return unidecode(text.lower().strip())
        
    def clean_nan(self, value):
        if value is None:
            return "20"
        if isinstance(value, float) and math.isnan(value):
            return "20"
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
        
        if total_candidates > 500:
            matches = self._process_partitions_parallel(
                candidate_partitions, normalized_input, has_number, input_number, min_similarity
            )
        else:
            matches = self._process_partitions_sequential(
                candidate_partitions, normalized_input, has_number, input_number, min_similarity
            )
        
        # Sort by score (highest first) and take top matches
        matches.sort(key=lambda x: (
            -x["is_exact_match"],           # Exact matches first (negative for desc order)
            -x["similarity_score"],         # Then by similarity score
            -x["partition_priority"],       # Then by partition priority
            x["address"]                    # Finally alphabetical for consistency
        ))
        return matches[:limit]

    def _get_partitioned_candidates(self, normalized_input, input_number):
        partitions = {
            'exact_match': [],
            'exact_number': [],
            'number_range': [],
            'text_match': [],
            'fallback': []
        }

        with self.driver.session() as session:
            # Partición 0: Búsqueda exacta primero
            result = session.run("""
                MATCH (i:Intersection)
                WHERE toLower(i.address) = $normalized_input
                RETURN i.address as address
                LIMIT 10
            """, normalized_input=normalized_input)
            partitions['exact_match'] = [record["address"] for record in result if record["address"]]
            
            if not partitions['exact_match']: # -> Solo buscar otras particiones si no hay coincidencia exacta
                # Partición 1: Coincidencia exacta de número
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
        
        priority_order = ['exact_match', 'exact_number', 'number_range', 'text_match', 'fallback']
        
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
            'exact_match': 0,
            'exact_number': -5,
            'number_range': -5,
            'text_match': 0,
            'fallback': +5
        }

        partition_priorities = {
            'exact_match': 5,
            'exact_number': 4,
            'number_range': 3,
            'text_match': 2,
            'fallback': 1
        }
        
        adjusted_min_similarity = min_similarity + partition_adjustments.get(partition_name, 0)
        
        for db_address in addresses:
            if not db_address:
                continue
            
            normalized_db = self.normalize_text(db_address)

            is_exact_match = normalized_input == normalized_db

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

            exact_match_boost = 50 if is_exact_match else 0
            
            final_score = score + score_boost + partition_boost.get(partition_name, 0) + exact_match_boost

            if is_exact_match:
                final_score = max(final_score, 150)
            else:
                final_score = min(final_score, 100)
            
            if final_score >= adjusted_min_similarity:
                matches.append({
                    "address": db_address,
                    "similarity_score": min(final_score, 100),
                    "normalized_input": normalized_input,
                    "normalized_db": normalized_db,
                    "partition": partition_name,
                    "is_exact_match": is_exact_match,
                    "partition_priority": partition_priorities.get(partition_name, 0)
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

    def find_shortest_path(self, start_location: str, end_location: str, bellman: bool=True):
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
                BELLMAN_FORD_STEP_BY_STEP_CYPHER_QUERY if bellman else A_STAR_STEP_BY_STEP_CYPHER_QUERY,
                start_address=start_address, 
                end_address=end_address,
                current_hour=12,
                day_type="weekday"
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

            total_travel_time = calculate_approx_time(clean_records)
       

        return {"tiempo_estimado": total_travel_time, "ruta": clean_records}
