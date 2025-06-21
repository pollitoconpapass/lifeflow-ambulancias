class RouteConverter {
    static latLngToLocal(lat, lng, centerLat, centerLng) {
        const scale = 100000;
        const x = (lng - centerLng) * scale;
        const z = -(lat - centerLat) * scale;
        return new THREE.Vector3(x, 0, z);
    }

    static convertRouteToWaypoints(routeData) {
        const centerLat = routeData[0].fromLat;
        const centerLng = routeData[0].fromLng; 
        const waypoints = [];
        let lastTo = null;
        
        routeData.forEach((step, index) => {
            const fromPoint = this.latLngToLocal(step.fromLat, step.fromLng, centerLat, centerLng);
            const toPoint = this.latLngToLocal(step.toLat, step.toLng, centerLat, centerLng);

            if (lastTo && fromPoint.distanceTo(lastTo) < 0.01) {
                return;
            }
            
            waypoints.push({
                from: fromPoint,
                to: toPoint,
                streetName: step.nombreCalle,
                speedLimit: step.velocidadMaxima_kmh ? parseInt(step.velocidadMaxima_kmh) : 50,
                distance: step.distancia_metros,
                stepIndex: index
            });
            lastTo = toPoint;
        });
        
        return waypoints;
    }

    static getRoutePoints(routeData) {
        const centerLat = routeData[0].fromLat;
        const centerLng = routeData[0].fromLng;
        const points = [];
        let last = null;
        routeData.forEach((step, idx) => {
            const fromLocal = this.latLngToLocal(step.fromLat, step.fromLng, centerLat, centerLng);
            const toLocal = this.latLngToLocal(step.toLat, step.toLng, centerLat, centerLng);
            if (idx === 0) points.push(fromLocal);
       
            if (!last || toLocal.distanceTo(last) > 0.2) {
                points.push(toLocal);
                last = toLocal;
            }
        });
        return points;
    }
}
