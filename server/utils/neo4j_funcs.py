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

A_STAR_MULTIPARADAS = """MATCH (start:Intersection {address: $start_address})
WITH start LIMIT 1
MATCH (end:Intersection {address: $end_address})    
WITH start, end LIMIT 1

// Handle poolpoints - they should be passed as a list parameter
// $poolpoints can be an empty list or contain 1-4 addresses
WITH start, end, 
    CASE 
        WHEN $poolpoints IS NULL OR size($poolpoints) = 0 THEN []
        ELSE $poolpoints 
    END AS poolpoint_addresses

// Match poolpoint nodes if they exist
OPTIONAL MATCH (p1:Intersection) WHERE p1.address = poolpoint_addresses[0]
OPTIONAL MATCH (p2:Intersection) WHERE p2.address = poolpoint_addresses[1]
OPTIONAL MATCH (p3:Intersection) WHERE p3.address = poolpoint_addresses[2]
OPTIONAL MATCH (p4:Intersection) WHERE p4.address = poolpoint_addresses[3]

WITH start, end, poolpoint_addresses,
    CASE size(poolpoint_addresses)
        WHEN 0 THEN [start, end]
        WHEN 1 THEN [start, p1, end]
        WHEN 2 THEN [start, p1, p2, end]
        WHEN 3 THEN [start, p1, p2, p3, end]
        WHEN 4 THEN [start, p1, p2, p3, p4, end]
        ELSE [start, end]
    END AS route_nodes

// Ensure all poolpoints were found
WHERE all(node IN route_nodes WHERE node IS NOT NULL)

// Calculate shortest paths between consecutive poolpoints
WITH route_nodes,
    range(0, size(route_nodes)-2) AS segment_indices

UNWIND segment_indices AS seg_idx
WITH route_nodes, seg_idx,
    route_nodes[seg_idx] AS segment_start,
    route_nodes[seg_idx + 1] AS segment_end

// Find shortest path for each segment
MATCH segment_path = shortestPath((segment_start)-[:ROAD_SEGMENT*]->(segment_end))
WHERE all(r IN relationships(segment_path) WHERE r.length IS NOT NULL)

WITH route_nodes, seg_idx, segment_path,
    nodes(segment_path) AS segment_nodes,
    relationships(segment_path) AS segment_rels,
    reduce(total = 0, r IN relationships(segment_path) | total + r.length) AS segment_distance

// Collect all segments in order
WITH route_nodes, 
    collect({
        segment_index: seg_idx,
        nodes: segment_nodes,
        relationships: segment_rels,
        distance: segment_distance
    }) AS segments

// Calculate total distance
WITH route_nodes, segments,
    reduce(total_dist = 0, seg IN segments | total_dist + seg.distance) AS total_distance

// Create step-by-step instructions
UNWIND segments AS segment
WITH route_nodes, segments, total_distance, segment
ORDER BY segment.segment_index

UNWIND range(0, size(segment.relationships)-1) AS rel_idx
WITH route_nodes, segments, total_distance, segment, rel_idx,
    segment.nodes[rel_idx] AS from_node,
    segment.nodes[rel_idx + 1] AS to_node,
    segment.relationships[rel_idx] AS road_rel,
    segment.segment_index AS current_segment,
    // Calculate cumulative step number across all segments - FIXED VERSION
    reduce(prev_steps = 0, prev_seg IN segments | 
        CASE WHEN prev_seg.segment_index < segment.segment_index 
             THEN prev_steps + size(prev_seg.relationships) 
             ELSE prev_steps 
        END) + rel_idx + 1 AS global_step

// Calculate heuristic distance to final destination
WITH route_nodes, total_distance, global_step, from_node, to_node, road_rel, rel_idx,
    point.distance(from_node.location, route_nodes[size(route_nodes)-1].location) AS heuristic_to_destination,
    current_segment, segment

RETURN 
    global_step AS paso,
    from_node.address AS desde,
    to_node.address AS hasta,
    from_node.location.y AS fromLat,
    from_node.location.x AS fromLng,
    to_node.location.y AS toLat,
    to_node.location.x AS toLng,
    road_rel.name AS nombreCalle,
    road_rel.highway AS tipoCalle,
    CASE WHEN road_rel.oneway = true THEN 'Sí' ELSE 'No' END AS unidireccional,
    road_rel.length AS distancia_metros,
    heuristic_to_destination AS distanciaLineaRectaAlDestino,
    road_rel.max_speed AS velocidadMaxima_kmh,
    CASE 
        WHEN global_step = 1 THEN 'Inicio'
        WHEN current_segment < size(route_nodes)-2 AND rel_idx = size(segment.relationships)-1 
            THEN 'Parada en: ' + to_node.address
        WHEN to_node = route_nodes[size(route_nodes)-1] THEN 'Destino final'
        ELSE 'Continuar por' 
    END AS instruccion,
    CASE WHEN global_step = 1 THEN total_distance ELSE null END AS distanciaTotal,
    current_segment + 1 AS segmento

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

    def find_shortest_path(self, start_location, end_location, poolpoints=None):
        start_address = self.get_address_from_hospital(start_location)
        end_address = self.get_address_from_hospital(end_location)

        if start_address is None:
            start_location_match = self.find_similar_address(start_location, limit=1)
            start_address = start_location_match[0]["address"]

        if end_address is None:
            end_location_match = self.find_similar_address(end_location, limit=1)
            end_address = end_location_match[0]["address"]

        # Process poolpoints
        poolpoint_addresses = []
        if poolpoints:
            # Limit to maximum 4 poolpoints
            poolpoints = poolpoints[:4] if len(poolpoints) > 4 else poolpoints
            
            for poolpoint in poolpoints:
                poolpoint_address = self.get_address_from_hospital(poolpoint)
                
                if poolpoint_address is None:
                    poolpoint_match = self.find_similar_address(poolpoint, limit=1)
                    poolpoint_address = poolpoint_match[0]["address"]
                
                poolpoint_addresses.append(poolpoint_address)

        print(f"Start location: {start_address}")
        print(f"End location: {end_address}")
        
        if poolpoint_addresses:
            print(f"poolpoints: {poolpoint_addresses}")
        
        with self.driver.session() as session:
            # Use the new multi-poolpoint query
            result = session.run(
                A_STAR_MULTIPARADAS,
                start_address=start_address, 
                end_address=end_address,
                poolpoints=poolpoint_addresses if poolpoint_addresses else []
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
