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
        this.ambulance = new Ambulance(this.gameScene.scene, this.points[0]);
        
        // Generate road
        this.road.generateRoad(this.points);

        // Generate traffic
        this.trafficManager = new TrafficManager(this.gameScene.scene, this.points);
        const playerStartSegment = 0
        this.trafficManager.populateInitialTraffic(playerStartSegment)
       
        
        // Generate buildings
        Buildings.createBuildingsAlongRoute(this.gameScene.scene, this.points);
        Trees.createTreesAlongRoute(this.gameScene.scene, this.points);
        Banners.createBannersAlongRoute(this.gameScene.scene, this.points);
        Houses.createHousesAlongRoute(this.gameScene.scene, this.points);

        // Placing the hospital at the end of the road
        const endPosition = this.points[this.points.length - 1]
        Hospital.createHospital(this.gameScene.scene, endPosition);
        
        // Start game loop
        this.animate();
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const deltaTime = this.clock.getDelta();
        
        // Update game objects
        this.ambulance.update(this.inputManager, this.waypoints);
        
        // Update camera
        this.gameScene.updateCamera(this.ambulance);
        
        // Update UI
        this.uiManager.updateUI(this.ambulance.currentWaypointIndex, this.ambulance.stepProgress, this.ambulance.speed);
        
        // Update traffic vehicles
        const playerSegment = this.ambulance.currentWaypointIndex || 0;
        this.trafficManager.update(deltaTime, playerSegment)

        // Render scene
        this.gameScene.render();
    }
}
