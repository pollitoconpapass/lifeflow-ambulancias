# Endpoints de Nominatim API (Obtener datos de OpenStreetMap) 🗺️

### Obtener numero de casa usando latitud y longitud
https://nominatim.openstreetmap.org/reverse?lat=-12.1159105&lon=-77.030588&format=json

- `lat`: latitud (y)
- `lon`: longitud (x)

### Obtener la longitud y latitud de una calle
https://nominatim.openstreetmap.org/lookup?osm_ids=W438901952&format=json
- `osm_ids`: OpenStreetMap ID de la calle (El W le indica que es una calle, "way")