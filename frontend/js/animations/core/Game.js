class Game {
    constructor(routeData) {
        this.clock = new THREE.Clock();
        this.routeData = routeData;
        this.gameScene = new GameScene();
        this.inputManager = new InputManager();
        this.uiManager = new UIManager(routeData);
        
        // Convert route data
        this.waypoints = RouteConverter.convertRouteToWaypoints(routeData);
        this.points = RouteConverter.getRoutePoints(routeData);
        
        // Create game objects
        this.road = new Road(this.gameScene.scene);
        this.vehicle = new Vehicle(this.gameScene.scene, this.points[0]);
        
        // Generate road
        this.road.generateRoad(this.points);

        this.trafficVehicles = [];
        const totalTraffic = 15;

        for (let i = 0; i < totalTraffic; i++) {    
            let type;
            // Randomly pick type, e.g., 65% car, 20% truck, 15% bus
            const r = Math.random();
            if (r < 0.65) type = "car";
            else if (r < 0.85) type = "truck";
            else type = "bus";

            this.trafficVehicles.push(new TrafficVehicle(this.gameScene.scene, this.points, { type }));
        }

        
        // Generate buildings
        Buildings.createBuildingsAlongRoute(this.gameScene.scene, this.points);
        Trees.createTreesAlongRoute(this.gameScene.scene, this.points);
        Banners.createBannersAlongRoute(this.gameScene.scene, this.points);
        Houses.createHousesAlongRoute(this.gameScene.scene, this.points);
        
        // Start game loop
        this.animate();
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const deltaTime = this.clock.getDelta();
        
        // Update game objects
        this.vehicle.update(this.inputManager, this.waypoints);
        
        // Update camera
        this.gameScene.updateCamera(this.vehicle);
        
        // Update UI
        this.uiManager.updateUI(this.vehicle.currentWaypointIndex, this.vehicle.stepProgress, this.vehicle.speed);
        
        // Update traffic vehicles
        this.trafficVehicles.forEach(vehicle => {
            vehicle.update(deltaTime, this.trafficVehicles);
        });

        // Render scene
        this.gameScene.render();
    }
}
