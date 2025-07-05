// Inicializar el mapa centrado en Lima
const map = L.map('map').setView([-12.0464, -77.0428], 13);

// Agregar capa de mapa de OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
}).addTo(map);

// Variables globales
let currentRoutes = {
    bellman: null,
    astar: null
};
let routeMarkers = {
    bellman: [],
    astar: []
};
let routeData = {
    bellman: null,
    astar: null
};
let selectedRoute = null; // 'bellman' or 'astar'

// Configuración de colores para las rutas
const routeConfig = {
    bellman: {
        color: '#3182ce',
        name: 'Algoritmo Bellman-Ford',
        icon: '🔵',
        endpoint: 'http://0.0.0.0:8082/shortest-path'
    },
    astar: {
        color: '#805ad5',
        name: 'Algoritmo A*',
        icon: '🟣',
        endpoint: 'http://0.0.0.0:8082/shortest-path-astar'
    }
};

// Función principal para calcular ambas rutas
async function calculateRoute() {
    const startLocation = document.getElementById('startLocation').value.trim();
    const endLocation = document.getElementById('endLocation').value.trim();
    
    // Validar inputs
    if (!startLocation || !endLocation) {
        showMessage('Por favor ingresa tanto la ubicación de inicio como la de destino.', 'error');
        return;
    }
    
    // Mostrar estado de carga
    const calculateBtn = document.getElementById('calculateBtn');
    const originalText = calculateBtn.textContent;
    calculateBtn.textContent = '⏳ Calculando rutas...';
    calculateBtn.disabled = true;
    
    // Limpiar rutas existentes
    clearAllRoutes();
    
    try {
        // Calcular ambas rutas en paralelo
        const [bellmanResult, astarResult] = await Promise.allSettled([
            fetchRoute('bellman', startLocation, endLocation),
            fetchRoute('astar', startLocation, endLocation)
        ]);
        
        let successCount = 0;
        let errorMessages = [];
        
        // Procesar resultado de Bellman-Ford
        if (bellmanResult.status === 'fulfilled') {
            routeData.bellman = processApiRouteData(bellmanResult.value.routeData);
            visualizeRoute('bellman', routeData.bellman, bellmanResult.value.totalTime);
            successCount++;
        } else {
            errorMessages.push(`Bellman-Ford: ${bellmanResult.reason.message}`);
        }
        
        // Procesar resultado de A*
        if (astarResult.status === 'fulfilled') {
            routeData.astar = processApiRouteData(astarResult.value.routeData);
            visualizeRoute('astar', routeData.astar, astarResult.value.totalTime);
            successCount++;
        } else {
            errorMessages.push(`A*: ${astarResult.reason.message}`);
        }
        
        if (successCount > 0) {
            // Mostrar panel de comparación
            showRouteComparison();
            
            // Ajustar vista del mapa para mostrar ambas rutas
            adjustMapView();
            
            // Seleccionar automáticamente la primera ruta disponible
            if (routeData.bellman) {
                selectRoute('bellman');
            } else if (routeData.astar) {
                selectRoute('astar');
            }
            
            // Configurar botón de vista 3D inmediatamente después de calcular las rutas
            const view3DBtn = document.getElementById('view3D');
            if (view3DBtn) {
                // Remover listeners anteriores
                const newBtn = view3DBtn.cloneNode(true);
                view3DBtn.parentNode.replaceChild(newBtn, view3DBtn);
                
                // Agregar nuevo listener
                newBtn.addEventListener('click', () => {
                    // Verificar que hay una ruta seleccionada
                    if (!selectedRoute) {
                        alert('Por favor selecciona una ruta primero antes de ver la simulación 3D.');
                        return;
                    }
                    
                    // Verificar que los datos estén guardados
                    const savedData = sessionStorage.getItem('routeData');
                    if (savedData) {
                        console.log('✅ Datos de ruta guardados correctamente');
                        console.log('🚀 Navegando a simulación 3D...');
                        window.location.href = './threejsAnimation.html';
                    } else {
                        console.error('❌ Error: No se pudieron guardar los datos de ruta');
                        alert('Error al preparar la simulación 3D. Por favor intenta de nuevo.');
                    }
                });
            }
            
            showMessage(`✅ ${successCount} ruta(s) calculada(s) exitosamente!`, 'success');
        } else {
            showMessage(`❌ Error al calcular las rutas: ${errorMessages.join(', ')}`, 'error');
        }
        
    } catch (error) {
        console.error('Error general al calcular rutas:', error);
        showMessage(`❌ Error general: ${error.message}`, 'error');
    } finally {
        // Restaurar botón
        calculateBtn.textContent = originalText;
        calculateBtn.disabled = false;
    }
}

// Función para obtener datos de una ruta específica
async function fetchRoute(routeType, startLocation, endLocation) {
    const endpoint = routeConfig[routeType].endpoint;
    
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            start_location: startLocation,
            end_location: endLocation
        })
    });
    
    if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
    }
    
    const data = await response.json();
    const routeData = data["ruta"];
    const totalTime = data["tiempo_estimado"];
    
    if (!routeData || routeData.length === 0) {
        throw new Error('No se encontró una ruta válida entre las ubicaciones especificadas.');
    }
    
    return { routeData, totalTime };
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
        fromCoords: [step.fromLat, step.fromLng],
        toCoords: [step.toLat, step.toLng]
    }));
}

// Función para visualizar una ruta específica
function visualizeRoute(routeType, routeData, totalTime) {
    if (!routeData || routeData.length === 0) return;
    
    const config = routeConfig[routeType];
    const coordinates = [];
    
    // Procesar coordenadas
    routeData.forEach((step, index) => {
        if (index === 0) {
            coordinates.push(step.fromCoords);
        }
        coordinates.push(step.toCoords);
    });
    
    // Crear polilínea de la ruta
    const routeStyle = {
        color: config.color,
        weight: 5,
        opacity: 0.7,
        smoothFactor: 1
    };
    
    currentRoutes[routeType] = L.polyline(coordinates, routeStyle).addTo(map);
    
    // Agregar marcadores solo para la primera ruta calculada
    if (Object.keys(currentRoutes).filter(key => currentRoutes[key]).length === 1) {
        const startMarker = L.marker(coordinates[0], {
            icon: L.divIcon({
                html: '🚩',
                iconSize: [30, 30],
                className: 'start-marker'
            })
        }).addTo(map).bindPopup(`<b>Inicio:</b><br>${routeData[0].desde}`);
        
        const endMarker = L.marker(coordinates[coordinates.length - 1], {
            icon: L.divIcon({
                html: '🏁',
                iconSize: [30, 30],
                className: 'end-marker'
            })
        }).addTo(map).bindPopup(`<b>Destino:</b><br>${routeData[routeData.length - 1].hasta}`);
        
        routeMarkers[routeType].push(startMarker, endMarker);
    }
    
    // Almacenar tiempo estimado
    currentRoutes[routeType].estimatedTime = totalTime;
}

// Función para mostrar el panel de comparación de rutas
function showRouteComparison() {
    // Crear o actualizar el panel de comparación
    let comparisonPanel = document.getElementById('routeComparison');
    if (!comparisonPanel) {
        comparisonPanel = document.createElement('div');
        comparisonPanel.id = 'routeComparison';
        comparisonPanel.className = 'route-comparison-panel';
        
        // Insertar después de los controles
        const controls = document.querySelector('.controls');
        controls.appendChild(comparisonPanel);
    }
    
    let panelHTML = `
        <div class="comparison-header">
            <h3>🔄 Comparación de Rutas</h3>
            <p>Selecciona la ruta que prefieres usar:</p>
        </div>
        <div class="route-options">
    `;
    
    // Agregar opciones de ruta disponibles
    Object.keys(routeConfig).forEach(routeType => {
        if (routeData[routeType]) {
            const config = routeConfig[routeType];
            const totalDistance = routeData[routeType].reduce((sum, step) => sum + step.distancia_metros, 0);
            const totalSteps = routeData[routeType].length;
            const estimatedTime = currentRoutes[routeType].estimatedTime;
            
            panelHTML += `
                <div class="route-option ${selectedRoute === routeType ? 'selected' : ''}" 
                     onclick="selectRoute('${routeType}')" 
                     data-route="${routeType}">
                    <div class="route-header">
                        <span class="route-icon">${config.icon}</span>
                        <span class="route-name">${config.name}</span>
                        <div class="route-indicator" style="background-color: ${config.color}"></div>
                    </div>
                    <div class="route-stats">
                        <div class="stat">
                            <strong>${Math.round(totalDistance / 1000 * 100) / 100} km</strong>
                            <span>Distancia</span>
                        </div>
                        <div class="stat">
                            <strong>${totalSteps}</strong>
                            <span>Pasos</span>
                        </div>
                        <div class="stat">
                            <strong>${estimatedTime} min</strong>
                            <span>Tiempo</span>
                        </div>
                    </div>
                </div>
            `;
        }
    });
    
    panelHTML += `
        </div>
        <div class="comparison-actions">
            <button onclick="confirmRouteSelection()" class="confirm-btn" ${!selectedRoute ? 'disabled' : ''}>
                ✅ Usar Ruta Seleccionada
            </button>
        </div>
    `;
    
    comparisonPanel.innerHTML = panelHTML;
    comparisonPanel.style.display = 'block';
}

// Función para seleccionar una ruta
function selectRoute(routeType) {
    selectedRoute = routeType;
    
    // Guardar inmediatamente la ruta seleccionada para el 3D
    const selectedRouteData = routeData[routeType];
    sessionStorage.setItem('routeData', JSON.stringify(selectedRouteData));
    sessionStorage.setItem('selectedRouteType', routeType);
    
    // Guardar información adicional
    const routeInfo = {
        startLocation: document.getElementById('startLocation').value,
        endLocation: document.getElementById('endLocation').value,
        routeType: routeType,
        totalSteps: selectedRouteData.length,
        timestamp: new Date().toISOString()
    };
    sessionStorage.setItem('routeInfo', JSON.stringify(routeInfo));
    
    // Actualizar estilos visuales de las rutas
    Object.keys(currentRoutes).forEach(type => {
        if (currentRoutes[type]) {
            const isSelected = type === routeType;
            currentRoutes[type].setStyle({
                color: routeConfig[type].color,
                weight: isSelected ? 7 : 4,
                opacity: isSelected ? 0.9 : 0.5
            });
        }
    });
    
    // Actualizar UI de selección
    document.querySelectorAll('.route-option').forEach(option => {
        option.classList.remove('selected');
    });
    
    const selectedOption = document.querySelector(`[data-route="${routeType}"]`);
    if (selectedOption) {
        selectedOption.classList.add('selected');
    }
    
    // Habilitar botón de confirmación
    const confirmBtn = document.querySelector('.confirm-btn');
    if (confirmBtn) {
        confirmBtn.disabled = false;
    }
    
    // Actualizar estadísticas principales
    updateMainStats(routeType);
    
    // Mostrar instrucciones de la ruta seleccionada
    displayRouteInstructions(routeData[routeType]);
}

// Función para confirmar la selección de ruta
function confirmRouteSelection() {
    if (!selectedRoute) {
        showMessage('Por favor selecciona una ruta primero.', 'error');
        return;
    }
    
    showMessage(`✅ Ruta ${routeConfig[selectedRoute].name} confirmada y lista para usar!`, 'success');
    
    // Ocultar panel de comparación
    const comparisonPanel = document.getElementById('routeComparison');
    if (comparisonPanel) {
        comparisonPanel.style.display = 'none';
    }
}

// Función para actualizar estadísticas principales
function updateMainStats(routeType) {
    const data = routeData[routeType];
    const totalDistance = data.reduce((sum, step) => sum + step.distancia_metros, 0);
    const estimatedTime = currentRoutes[routeType].estimatedTime;
    
    document.getElementById('totalDistance').textContent = Math.round(totalDistance / 1000 * 100) / 100;
    document.getElementById('totalSteps').textContent = data.length;
    document.getElementById('estimatedTime').textContent = estimatedTime;
    document.getElementById('routeStats').style.display = 'flex';
}

// Función para ajustar la vista del mapa
function adjustMapView() {
    const allCoordinates = [];
    
    Object.keys(currentRoutes).forEach(routeType => {
        if (currentRoutes[routeType]) {
            allCoordinates.push(...currentRoutes[routeType].getLatLngs());
        }
    });
    
    if (allCoordinates.length > 0) {
        const group = new L.featureGroup(Object.values(currentRoutes).filter(route => route));
        map.fitBounds(group.getBounds(), { padding: [20, 20] });
    }
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

// Función para limpiar todas las rutas
function clearAllRoutes() {
    Object.keys(currentRoutes).forEach(routeType => {
        if (currentRoutes[routeType]) {
            map.removeLayer(currentRoutes[routeType]);
            currentRoutes[routeType] = null;
        }
        
        routeMarkers[routeType].forEach(marker => map.removeLayer(marker));
        routeMarkers[routeType] = [];
    });
    
    routeData.bellman = null;
    routeData.astar = null;
    selectedRoute = null;
    
    document.getElementById('routeStats').style.display = 'none';
    document.getElementById('routeInfo').style.display = 'none';
    
    const comparisonPanel = document.getElementById('routeComparison');
    if (comparisonPanel) {
        comparisonPanel.style.display = 'none';
    }
}

// Función para mostrar mensajes (mantener la original)
function showMessage(message, type = 'info') {
    const existingMessages = document.querySelectorAll('.error-message, .success-message');
    existingMessages.forEach(msg => msg.remove());
    
    const messageDiv = document.createElement('div');
    messageDiv.className = type === 'error' ? 'error-message' : 'success-message';
    messageDiv.textContent = message;
    
    const controls = document.querySelector('.controls');
    controls.appendChild(messageDiv);
    
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 5000);
}

// Función para limpiar ruta (mantener compatibilidad)
function clearRoute() {
    clearAllRoutes();
}

// Eventos del DOM
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
    
    document.getElementById('calculateBtn').addEventListener('click', calculateRoute);
});

// Evento para manejar clicks en el mapa
map.on('click', function(e) {
    console.log('Coordenadas:', e.latlng.lat, e.latlng.lng);
});