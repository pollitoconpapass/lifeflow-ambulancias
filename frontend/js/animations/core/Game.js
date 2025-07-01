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

        // this.ambulance.debugWaypoints(this.waypoints)
        
        // Generate road
        this.road.generateRoad(this.points);

        // Initialize traffic system with driver data
        this.initializeTrafficSystem();

        // // Generate traffic
        // this.trafficManager = new TrafficManager(this.gameScene.scene, this.points);
        // const playerStartSegment = 0
        // this.trafficManager.populateInitialTraffic(playerStartSegment)
       
        
        // Generate buildings
        Buildings.createBuildingsAlongRoute(this.gameScene.scene, this.points);
        Trees.createTreesAlongRoute(this.gameScene.scene, this.points);
        Banners.createBannersAlongRoute(this.gameScene.scene, this.points);
        Houses.createHousesAlongRoute(this.gameScene.scene, this.points);

        // Placing the hospital at the end of the road
        const endPosition = this.points[this.points.length - 1]
        Hospital.createHospital(this.gameScene.scene, endPosition);

        window.gameInstance = this
        
        // Start game loop
        this.animate();
    }

    async initializeTrafficSystem() {
        try {
            // Create driver data manager
            window.driverDataManager = new DriverManager();

            // Create enhanced traffic manager
            this.trafficManager = new TrafficManagerWithDrivers(
                this.gameScene.scene, 
                this.points, 
                window.driverDataManager
            );

            // Initialize with CSV data
            const csvPath = '/Users/jose/Documents/uni-docs/complejidad/lifeflow-ambulancias/data/placas_carros.csv';
            
            console.log('Loading driver data from CSV...');
            const success = await this.trafficManager.initialize(csvPath);
            
            if (success) {
                console.log('Driver data loaded successfully!');
            } else {
                console.log('Using fallback driver data');
            }

            // Populate initial traffic after data is loaded
            const playerStartSegment = 0;
            this.trafficManager.populateInitialTraffic(playerStartSegment);
            
        } catch (error) {
            console.error('Error initializing traffic system:', error);
            
            // Fallback to original system if there's an error
            this.trafficManager = new TrafficManager(this.gameScene.scene, this.points);
            const playerStartSegment = 0;
            this.trafficManager.populateInitialTraffic(playerStartSegment);
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const deltaTime = this.clock.getDelta();
        
        // Update game objects
        this.ambulance.update(this.inputManager, this.waypoints);
        recordSpeedSample(this.ambulance.speed)
        
        // Update camera
        this.gameScene.updateCamera(this.ambulance);
        
        // Update UI
        this.uiManager.updateUI(this.ambulance.currentWaypointIndex, this.ambulance.stepProgress, this.ambulance.speed);
        
        // Update traffic vehicles
        const playerSegment = this.ambulance.currentWaypointIndex || 0;
        if (this.trafficManager) {
            this.trafficManager.update(deltaTime, playerSegment);
        }


        // Render scene
        this.gameScene.render();
    }
}
