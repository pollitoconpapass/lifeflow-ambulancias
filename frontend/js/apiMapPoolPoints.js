// Inicializar el mapa centrado en Lima
const map = L.map('map').setView([-12.0464, -77.0428], 13);

// Agregar capa de mapa de OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: ' OpenStreetMap contributors',
    maxZoom: 19
}).addTo(map);

// Variables globales
let currentRoute = null;
let routeMarkers = [];
let waypointCounter = 0;

// Función para agregar un nuevo waypoint
function addWaypoint() {
    const waypointsContainer = document.getElementById('waypointsContainer');
    const waypointId = `waypoint-${waypointCounter++}`;
    
    const waypointDiv = document.createElement('div');
    waypointDiv.className = 'form-row waypoint-row';
    waypointDiv.id = waypointId;
    
    waypointDiv.innerHTML = `
        <div class="input-group" style="flex: 1;">
            <label>Punto Intermedio</label>
            <input type="text" class="waypoint" placeholder="Ej: Av. Benavides 123, Miraflores">
        </div>
        <button type="button" class="remove-waypoint" onclick="removeWaypoint('${waypointId}')">
            ❌
        </button>
    `;
    
    waypointsContainer.appendChild(waypointDiv);
}

// Función para eliminar un waypoint
function removeWaypoint(waypointId) {
    const element = document.getElementById(waypointId);
    if (element) {
        element.remove();
    }
}

// Función para obtener los waypoints
function getWaypoints() {
    const waypointInputs = document.querySelectorAll('.waypoint');
    const waypoints = [];
    
    waypointInputs.forEach(input => {
        if (input.value.trim() !== '') {
            waypoints.push(input.value.trim());
        }
    });
    
    return waypoints;
}

// Función para calcular ruta usando la API
async function calculateRoute() {
    const startLocation = document.getElementById('startLocation').value.trim();
    const endLocation = document.getElementById('endLocation').value.trim();
    const waypoints = getWaypoints();
    const apiEndpoint = "http://0.0.0.0:8082/shortest-path-poolpoints";
    
    // Validar inputs
    if (!startLocation || !endLocation) {
        showMessage('Por favor ingresa tanto la ubicación de inicio como la de destino.', 'error');
        return;
    }
    
    if (!apiEndpoint) {
        showMessage('Por favor ingresa la URL del endpoint de la API.', 'error');
        return;
    }
    
    // Mostrar estado de carga
    const calculateBtn = document.getElementById('calculateBtn');
    const originalText = calculateBtn.textContent;
    calculateBtn.textContent = '⏳ Calculando...';
    calculateBtn.disabled = true;
    
    try {
        // Construir el cuerpo de la petición
        const requestBody = {
            start_location: startLocation,
            end_location: endLocation
        };
        
        // Agregar waypoints si existen
        if (waypoints.length > 0) {
            requestBody.waypoints = waypoints;
        }
        
        // Hacer petición a la API
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
        }
        
        const routeData = await response.json();
        
        if (!routeData || routeData.length === 0) {
            throw new Error('No se encontró una ruta válida entre las ubicaciones especificadas.');
        }
        
        // Procesar y visualizar la ruta
        const processedRoute = processApiRouteData(routeData);
        visualizeRoute(processedRoute);
        
        showMessage(`✅ Ruta calculada exitosamente! ${routeData.length} pasos encontrados.`, 'success');
        
    } catch (error) {
        console.error('Error al calcular la ruta:', error);
        showMessage(`❌ Error al calcular la ruta: ${error.message}`, 'error');
    } finally {
        // Restaurar botón
        calculateBtn.textContent = originalText;
        calculateBtn.disabled = false;
    }
}

// Función para procesar datos de la API
function processApiRouteData(apiData) {
    return apiData.map(step => ({
        paso: step.paso,
        desde: step.desde,
        hasta: step.hasta,
        nombreCalle: step.nombreCalle,
        tipoCalle: step.tipoCalle,
        unidireccional: step.unidireccional,
        distancia_metros: step.distancia_metros,
        velocidadMaxima_kmh: step.velocidadMaxima_kmh,
        instruccion: step.instruccion,
        osmid: step.OSMID,
        // Convertir coordenadas de la API al formato de Leaflet [lat, lng]
        fromCoords: [step.fromLat, step.fromLng],
        toCoords: [step.toLat, step.toLng]
    }));
}

// Función para mostrar mensajes
function showMessage(message, type = 'info') {
    // Remover mensajes anteriores
    const existingMessages = document.querySelectorAll('.error-message, .success-message');
    existingMessages.forEach(msg => msg.remove());
    
    // Crear nuevo mensaje
    const messageDiv = document.createElement('div');
    messageDiv.className = type === 'error' ? 'error-message' : 'success-message';
    messageDiv.textContent = message;
    
    // Insertar después de los controles
    const controls = document.querySelector('.controls');
    controls.appendChild(messageDiv);
    
    // Auto-remover después de 5 segundos
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 5000);
}

// Función para obtener color según tipo de calle
function getRoadColor(highway) {
    const colors = {
        'residential': '#3498db',
        'primary': '#e74c3c',
        'secondary': '#f39c12',
        'tertiary': '#27ae60',
        'trunk': '#9b59b6'
    };
    return colors[highway] || '#95a5a6';
}

// Función para cargar y visualizar ruta
function visualizeRoute(routeData) {
    clearRoute();
    
    if (!routeData || routeData.length === 0) return;
    
    const coordinates = [];
    const steps = [];
    let totalDistance = 0;
    
    // Procesar datos de ruta con coordenadas reales de Neo4j
    routeData.forEach((step, index) => {
        // Las coordenadas vienen directamente de Neo4j
        const fromCoords = step.fromCoords;
        const toCoords = step.toCoords;
        
        if (index === 0) {
            coordinates.push(fromCoords);
        }
        coordinates.push(toCoords);
        
        totalDistance += step.distancia_metros;
        steps.push(step);
    });
    
    // Crear polilínea de la ruta
    currentRoute = L.polyline(coordinates, {
        color: '#721ca3',
        weight: 6,
        opacity: 0.8,
        smoothFactor: 1
    }).addTo(map);
    
    // Agregar marcador de inicio
    const startMarker = L.marker(coordinates[0], {
        icon: L.divIcon({
            html: '👇',
            iconSize: [30, 30],
            className: 'start-marker'
        })
    }).addTo(map).bindPopup(`<b>Inicio:</b><br>${routeData[0].desde}`);
    
    // Agregar marcadores de waypoints
    const waypointMarkers = [];
    if (routeData.length > 2) {
        for (let i = 1; i < routeData.length - 1; i++) {
            const waypointMarker = L.marker(coordinates[i], {
                icon: L.divIcon({
                    html: '📍',
                    iconSize: [25, 25],
                    className: 'waypoint-marker'
                })
            }).addTo(map).bindPopup(`<b>Punto Intermedio ${i}:</b><br>${routeData[i].hasta}`);
            waypointMarkers.push(waypointMarker);
        }
    }
    
    // Agregar marcador de fin
    const endMarker = L.marker(coordinates[coordinates.length - 1], {
        icon: L.divIcon({
            html: '💎',
            iconSize: [30, 30],
            className: 'end-marker'
        })
    }).addTo(map).bindPopup(`<b>Destino:</b><br>${routeData[routeData.length - 1].hasta}`);
    
    // Guardar referencias a los marcadores
    routeMarkers = [startMarker, ...waypointMarkers, endMarker];
    
    // Ajustar vista del mapa a la ruta
    map.fitBounds(currentRoute.getBounds(), { padding: [20, 20] });
    
    // Mostrar estadísticas
    updateStats(totalDistance, steps.length);
    
    // Mostrar instrucciones
    displayRouteInstructions(steps);
}

// Función para actualizar estadísticas
function updateStats(distance, stepCount) {
    document.getElementById('totalDistance').textContent = Math.round(distance);
    document.getElementById('totalSteps').textContent = stepCount;
    document.getElementById('estimatedTime').textContent = Math.round(distance / 1000 * 3); // Estimación básica
    document.getElementById('routeStats').style.display = 'flex';
}

// Función para mostrar instrucciones de ruta
function displayRouteInstructions(steps) {
    const stepsContainer = document.getElementById('routeSteps');
    stepsContainer.innerHTML = '';
    
    steps.forEach((step, index) => {
        const stepDiv = document.createElement('div');
        stepDiv.className = 'step';
        
        const roadTypeClass = `road-${step.tipoCalle}`;
        
        stepDiv.innerHTML = `
            <div class="step-header">
                ${step.paso}. ${step.instruccion} ${step.nombreCalle}
                <span class="road-type ${roadTypeClass}">${step.tipoCalle}</span>
            </div>
            <div class="step-details">
                📍 Desde: ${step.desde}<br>
                📍 Hasta: ${step.hasta}<br>
                📏 Distancia: ${Math.round(step.distancia_metros)} metros
                ${step.velocidadMaxima_kmh ? ` | 🚗 Vel. máx: ${step.velocidadMaxima_kmh} km/h` : ''}
                ${step.unidireccional === 'Sí' ? ' | ⬆️ Unidireccional' : ''}
            </div>
        `;
        
        stepsContainer.appendChild(stepDiv);
    });
    
    document.getElementById('routeInfo').style.display = 'block';
}

// Función para limpiar ruta
function clearRoute() {
    if (currentRoute) {
        map.removeLayer(currentRoute);
        currentRoute = null;
    }
    
    routeMarkers.forEach(marker => map.removeLayer(marker));
    routeMarkers = [];
    
    document.getElementById('routeStats').style.display = 'none';
    document.getElementById('routeInfo').style.display = 'none';
}

// Función para procesar datos de Neo4j (para tu uso)
function processNeo4jRouteData(neo4jResults) {
    return neo4jResults.map(record => ({
        paso: record.paso,
        desde: record.desde,
        hasta: record.hasta,
        nombreCalle: record.nombreCalle,
        tipoCalle: record.tipoCalle,
        unidireccional: record.unidireccional,
        distancia_metros: record.distancia_metros,
        velocidadMaxima_kmh: record.velocidadMaxima_kmh,
        instruccion: record.instruccion,
        osmid: record.OSMID
    }));
}

// Evento para manejar clicks en el mapa (opcional)
map.on('click', function(e) {
    console.log('Coordenadas:', e.latlng.lat, e.latlng.lng);
});

// Eventos para manejar Enter en los campos de input
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('startLocation').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            calculateRoute();
        }
    });
    
    document.getElementById('endLocation').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            calculateRoute();
        }
    });
    
    // Asignar el manejador de eventos al botón de calcular ruta
    document.getElementById('calculateBtn').addEventListener('click', calculateRoute);
    
    // Evento para agregar waypoints
    const addWaypointBtn = document.getElementById('addWaypointBtn');
    if (addWaypointBtn) {
        addWaypointBtn.addEventListener('click', addWaypoint);
    }
});
