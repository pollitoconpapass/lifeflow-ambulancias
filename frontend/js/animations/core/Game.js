class Game {
    constructor(routeData) {
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
        
        // Start game loop
        this.animate();
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Update game objects
        this.vehicle.update(this.inputManager, this.waypoints);
        
        // Update camera
        this.gameScene.updateCamera(this.vehicle);
        
        // Update UI
        this.uiManager.updateUI(this.vehicle.currentWaypointIndex, this.vehicle.stepProgress, this.vehicle.speed);
        
        // Render scene
        this.gameScene.render();
    }
}

