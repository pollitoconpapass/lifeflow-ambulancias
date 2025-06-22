// Función para cargar datos de ruta dinámicamente
function loadRouteData() {
    try {
        // Intentar cargar desde sessionStorage (datos de la pantalla anterior)
        const storedRouteData = sessionStorage.getItem('routeData');
        
        if (storedRouteData) {
            console.log('✅ Cargando datos de ruta desde sessionStorage');
            return JSON.parse(storedRouteData);
        } else {
            console.warn('⚠️ No se encontraron datos de ruta en sessionStorage');
            
            // Fallback: usar datos hardcodeados para desarrollo/testing
            console.log('📝 Usando datos de ruta de fallback para testing');
            return getFallbackRouteData();
        }
    } catch (error) {
        console.error('❌ Error al cargar datos de ruta:', error);
        
        // En caso de error, usar datos de fallback
        console.log('📝 Usando datos de ruta de fallback debido a error');
        return getFallbackRouteData();
    }
}

// Función que convierte los datos del sessionStorage al formato esperado por el Game
function convertSessionDataToGameFormat(sessionData) {
    return sessionData.map(step => ({
        paso: step.paso,
        desde: step.desde,
        hasta: step.hasta,
        fromLat: step.fromCoords[0], // sessionStorage guarda como [lat, lng]
        fromLng: step.fromCoords[1],
        toLat: step.toCoords[0],
        toLng: step.toCoords[1],
        nombreCalle: step.nombreCalle,
        tipoCalle: step.tipoCalle,
        unidireccional: step.unidireccional,
        distancia_metros: step.distancia_metros,
        distanciaLineaRectaAlDestino: step.distanciaLineaRectaAlDestino || 0,
        velocidadMaxima_kmh: step.velocidadMaxima_kmh,
        instruccion: step.instruccion,
        distanciaTotal: step.distanciaTotal || null
    }));
}

// Datos de fallback para desarrollo/testing
function getFallbackRouteData() {
    return [
        {
            "paso": 1,
            "desde": "Jirón Andrés Vesalio 101",
            "hasta": "Avenida de las Artes Sur 760",
            "fromLat": -12.1051572,
            "fromLng": -77.0086219,
            "toLat": -12.1051525,
            "toLng": -77.0063033,
            "nombreCalle": "Jirón Andrés Vesalio",
            "tipoCalle": "residential",
            "unidireccional": "Sí",
            "distancia_metros": 252.0935918891389,
            "distanciaLineaRectaAlDestino": 1307.5973306759172,
            "velocidadMaxima_kmh": "40",
            "instruccion": "Inicio",
            "distanciaTotal": 1732.264164298411
        },
        {
            "paso": 2,
            "desde": "Avenida de las Artes Sur 760",
            "hasta": "Jirón Gregorio Marañón 232",
            "fromLat": -12.1051525,
            "fromLng": -77.0063033,
            "toLat": -12.1051551,
            "toLng": -77.0056626,
            "nombreCalle": "Jirón Andrés Vesalio",
            "tipoCalle": "residential",
            "unidireccional": "Sí",
            "distancia_metros": 69.65916452068515,
            "distanciaLineaRectaAlDestino": 1106.9573981269039,
            "velocidadMaxima_kmh": "40",
            "instruccion": "Continuar por",
            "distanciaTotal": null
        }
    ];
}

// Función para mostrar información de debug
function showRouteDebugInfo(routeData) {
    console.log('🛣️ Información de la ruta cargada:');
    console.log(`📍 Pasos totales: ${routeData.length}`);
    console.log(`🏁 Inicio: ${routeData[0]?.desde}`);
    console.log(`🎯 Destino: ${routeData[routeData.length - 1]?.hasta}`);
    
    const totalDistance = routeData.reduce((sum, step) => sum + (step.distancia_metros || 0), 0);
    console.log(`📏 Distancia total: ${Math.round(totalDistance)} metros`);
}

// Función para validar datos de ruta
function validateRouteData(routeData) {
    if (!Array.isArray(routeData) || routeData.length === 0) {
        throw new Error('Los datos de ruta están vacíos o no son válidos');
    }
    
    // Validar que cada paso tenga las propiedades necesarias
    for (let i = 0; i < routeData.length; i++) {
        const step = routeData[i];
        if (!step.fromLat || !step.fromLng || !step.toLat || !step.toLng) {
            throw new Error(`Paso ${i + 1} no tiene coordenadas válidas`);
        }
    }
    
    return true;
}

// Función principal de inicialización
function initializeGame() {
    try {
        // Cargar datos de ruta
        let routeData = loadRouteData();
        
        // Si los datos vienen del sessionStorage, convertir al formato esperado
        const storedData = sessionStorage.getItem('routeData');
        if (storedData) {
            const sessionData = JSON.parse(storedData);
            routeData = convertSessionDataToGameFormat(sessionData);
        }
        
        // Validar datos
        validateRouteData(routeData);
        
        // Mostrar información de debug
        showRouteDebugInfo(routeData);
        
        // Inicializar el juego con los datos cargados
        const game = new Game(routeData);
        console.log('🎮 Juego inicializado correctamente');
        
        return game;
        
    } catch (error) {
        console.error('❌ Error al inicializar el juego:', error);
        
        // Mostrar mensaje de error al usuario
        showErrorMessage(error.message);
        
        // Intentar cargar con datos de fallback como último recurso
        try {
            console.log('🔄 Intentando cargar con datos de fallback...');
            const fallbackData = getFallbackRouteData();
            const game = new Game(fallbackData);
            console.log('✅ Juego inicializado con datos de fallback');
            return game;
        } catch (fallbackError) {
            console.error('💥 Error crítico: No se pudo inicializar el juego:', fallbackError);
            showCriticalErrorMessage();
        }
    }
}

// Función para mostrar mensajes de error al usuario
function showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255, 0, 0, 0.9);
        color: white;
        padding: 20px;
        border-radius: 8px;
        z-index: 1000;
        text-align: center;
        font-family: Arial, sans-serif;
    `;
    errorDiv.innerHTML = `
        <h3>⚠️ Error al cargar la ruta</h3>
        <p>${message}</p>
        <button onclick="window.history.back()" style="
            background: white;
            color: red;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 10px;
        ">Volver atrás</button>
    `;
    document.body.appendChild(errorDiv);
}

// Función para mostrar error crítico
function showCriticalErrorMessage() {
    document.body.innerHTML = `
        <div style="
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background: #000;
            color: white;
            font-family: Arial, sans-serif;
            text-align: center;
        ">
            <div>
                <h1>💥 Error Crítico</h1>
                <p>No se pudo cargar la simulación 3D</p>
                <button onclick="window.location.href='osm_mapping.html'" style="
                    background: #3182ce;
                    color: white;
                    border: none;
                    padding: 15px 30px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                    margin: 10px;
                ">Volver al Mapa</button>
                <button onclick="window.location.href='home.html'" style="
                    background: #666;
                    color: white;
                    border: none;
                    padding: 15px 30px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                    margin: 10px;
                ">Inicio</button>
            </div>
        </div>
    `;
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Iniciando carga de simulación 3D...');
    initializeGame();
});

// Función adicional para debug - puedes llamarla desde la consola
window.debugRoute = function() {
    const stored = sessionStorage.getItem('routeData');
    if (stored) {
        console.log('📊 Datos en sessionStorage:', JSON.parse(stored));
    } else {
        console.log('❌ No hay datos en sessionStorage');
    }
};