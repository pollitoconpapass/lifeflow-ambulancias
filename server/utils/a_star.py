import math

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

def clean_nan(value):
        if isinstance(value, float) and math.isnan(value):
            return None
        return value

def find_shortest_path(driver, start_location, end_location):
    with driver.session() as session:
        result = session.run(A_STAR_STEP_BY_STEP_CYPHER_QUERY, 
                            start_address=start_location, 
                            end_address=end_location
        )
        records = []
        for record in result:
            clean_record = {}
            for key, value in record.items():
                if value is not None:
                    if hasattr(value, 'items'):
                        clean_record[key] = {k: clean_nan(v) for k, v in value.items()}
                    else:
                        clean_record[key] = clean_nan(value)
                else:
                    clean_record[key] = None
            records.append(clean_record)

        return records
