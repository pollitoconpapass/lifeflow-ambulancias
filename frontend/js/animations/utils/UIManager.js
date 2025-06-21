class UIManager {
    constructor(routeData) {
        this.routeData = routeData;
    }

    updateUI(currentStepIndex, stepProgress, carSpeed) {
        if (currentStepIndex < this.routeData.length) {
            const currentStep = this.routeData[currentStepIndex];
            document.getElementById('currentStep').textContent = currentStep.paso;
            document.getElementById('fromStreet').textContent = currentStep.desde;
            document.getElementById('toStreet').textContent = currentStep.hasta;
            document.getElementById('distance').textContent = currentStep.distancia_metros.toFixed(0);
            document.getElementById('speedLimit').textContent = currentStep.velocidadMaxima_kmh || '-';
        }
        
        document.getElementById('progress').textContent = stepProgress.toFixed(0);
        document.getElementById('speed').textContent = carSpeed.toFixed(0);
    }
}
