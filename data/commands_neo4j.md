## Comandos CYPHER de Neo4j para la base de datos de LifeFlow

- Listar las relaciones (calles) que tengan cierto nombre
    ```sql
    MATCH (a)-[r:ROAD_SEGMENT]->(b)
    WHERE r.name = "Jirón Fray Luís de León"
    RETURN a, r, b
    ```

- Listar las relaciones (calles) que contengan cierto nombre (cuando no sepas exactamente el nombre)
    ```sql
    MATCH (a)-[r:ROAD_SEGMENT]->(b)
    WHERE r.name CONTAINS "Fray"
    RETURN DISTINCT r.name
    ``` 
- Listar las calles que se relacionen con cierto nodo
    ```sql
    MATCH (intersection:Intersection)
    WHERE intersection.osmid = 419482625 // (change this to the osmid of the node you want to search)
    MATCH (intersection)-[r:ROAD_SEGMENT]-(connected)
    WHERE r.name IS NOT NULL
    RETURN r.name AS street_name, r.highway AS road_type, r.length AS distance
    ORDER BY r.highway, r.length
    LIMIT 1
    ```

- NODO QUE ME DIO LA DIRECCION Y NUMERO DE CASA DAAAA
https://nominatim.openstreetmap.org/reverse?lat=-12.1159105&lon=-77.030588&format=json



- Primera Version Dijkstra
```sql
MATCH (start:Intersection {osmid: 412529889}),
      (end:Intersection {osmid: 263926465})
CALL apoc.algo.dijkstra(start, end, 'ROAD_SEGMENT', 'length') 
YIELD path, weight
RETURN path, weight
```


- Dijkstra only in CYPHER
```sql
MATCH (start:Intersection {address: 'Jirón Andrés Vesalio 101'})
MATCH (end:Intersection {address: 'Avenida Arequipa 4545'})
MATCH p = shortestPath((start)-[:ROAD_SEGMENT*]->(end))
WHERE all(r IN relationships(p) WHERE r.length IS NOT NULL)
RETURN p,
       [n IN nodes(p) | n.address] AS addresses,
       [r IN relationships(p) | r.name] AS streetNames,
       reduce(total = 0, r IN relationships(p) | total + r.length) AS totalDistance
```

- Dijkstra con instrucciones paso a paso
```sql
MATCH (start:Intersection {address: 'Jirón Andrés Vesalio 101'})
WITH start LIMIT 1  // Asegurarse de usar solo un nodo de inicio
MATCH (end:Intersection {address: 'Avenida Arequipa 4545'})
WITH start, end LIMIT 1  // Asegurarse de usar solo un nodo de llegada
MATCH p = shortestPath((start)-[:ROAD_SEGMENT*]->(end))
WHERE all(r IN relationships(p) WHERE r.length IS NOT NULL)
WITH p
ORDER BY reduce(total = 0, r IN relationships(p) | total + r.length) ASC
LIMIT 1  // Solo la ruta más corta
WITH p, nodes(p) AS nodes, relationships(p) AS rels
UNWIND range(0, size(rels)-1) AS i
RETURN 
    i + 1 AS paso,
    nodes[i].address AS desde,
    nodes[i+1].address AS hasta,
    rels[i].name AS nombreCalle,
    rels[i].highway AS tipoCalle,
    CASE WHEN rels[i].oneway = true THEN 'Sí' ELSE 'No' END AS unidireccional,
    rels[i].length AS distancia_metros,
    rels[i].max_speed AS velocidadMaxima_kmh,
    CASE 
        WHEN i = 0 THEN 'Inicio' 
        WHEN i = size(rels)-1 THEN 'Destino' 
        ELSE 'Continuar por' 
    END AS instruccion,
    CASE 
        WHEN i = 0 THEN reduce(total = 0, r IN relationships(p) | total + r.length)
        ELSE null 
    END AS distanciaTotal
ORDER BY paso;
```

- A* con instrucciones paso a paso
```sql
MATCH (start:Intersection {address: 'Jirón Andrés Vesalio 101'})
WITH start LIMIT 1
MATCH (end:Intersection {address: 'Avenida Arequipa 4545'})
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
```
