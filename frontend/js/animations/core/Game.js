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

        // Initialize traffic system with driver data
        this.initializeTrafficSystem();
        
        // Generate buildings and environment
        Buildings.createBuildingsAlongRoute(this.gameScene.scene, this.points);
        Trees.createTreesAlongRoute(this.gameScene.scene, this.points);
        Banners.createBannersAlongRoute(this.gameScene.scene, this.points);
        Houses.createHousesAlongRoute(this.gameScene.scene, this.points);

        // Placing the hospital at the end of the road
        const endPosition = this.points[this.points.length - 1];
        Hospital.createHospital(this.gameScene.scene, endPosition);

        window.gameInstance = this;
        
        // Start game loop
        this.animate();
    }

    async initializeTrafficSystem() {
        try {
            // Create driver data manager with your new endpoint
            window.driverDataManager = new DriverManager();

            // Create enhanced traffic manager using the enhanced vehicle class
            this.trafficManager = new TrafficManagerWithEnhancedDrivers(
                this.gameScene.scene, 
                this.points, 
                window.driverDataManager
            );

            // Initialize with your new endpoint (filePath parameter is now ignored)
            console.log('Loading driver data from FastAPI endpoint...');
            const success = await this.trafficManager.initialize();
            
            if (success) {
                console.log('Driver data loaded successfully from API!');
            } else {
                console.log('Using fallback driver data');
            }

            // Populate initial traffic after data is loaded
            const playerStartSegment = 0;
            this.trafficManager.populateInitialTraffic(playerStartSegment);
            
            // Initialize emergency lane change system after traffic is ready
            this.initializeEmergencySystem();
            
        } catch (error) {
            console.error('Error initializing traffic system:', error);
            
            // Fallback to original system if there's an error
            this.trafficManager = new TrafficManager(this.gameScene.scene, this.points);
            const playerStartSegment = 0;
            this.trafficManager.populateInitialTraffic(playerStartSegment);
        }
    }

    initializeEmergencySystem() {
        // Wait a moment for traffic to settle
        setTimeout(() => {
            if (this.trafficManager && this.ambulance) {
                this.emergencyLaneChangeManager = new EmergencyLaneChangeManager(
                    this.trafficManager, 
                    this.ambulance
                );
                console.log('🚨 Emergency lane change system initialized');
                
                // Add debug info to console
                console.log('Available emergency commands:');
                console.log('- gameInstance.getEmergencyStatus() - Check emergency system status');
                console.log('- gameInstance.forceEmergencyScenario() - Force emergency test');
                console.log('- gameInstance.getTrafficInfo() - Get traffic and driver info');
            }
        }, 2000);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const deltaTime = this.clock.getDelta();
        
        // Update game objects
        this.ambulance.update(this.inputManager, this.waypoints);
        recordSpeedSample(this.ambulance.speed);
        
        // Update camera
        this.gameScene.updateCamera(this.ambulance);
        
        // Update UI
        this.uiManager.updateUI(
            this.ambulance.currentWaypointIndex, 
            this.ambulance.stepProgress, 
            this.ambulance.speed
        );
        
        // Update traffic vehicles (now with emergency capabilities)
        const playerSegment = this.ambulance.currentWaypointIndex || 0;
        if (this.trafficManager) {
            this.trafficManager.update(deltaTime, playerSegment);
        }

        // Update emergency lane change system
        if (this.emergencyLaneChangeManager) {
            this.emergencyLaneChangeManager.update(deltaTime);
        }

        // Render scene
        this.gameScene.render();
    }

    // Enhanced traffic info including emergency status
    getTrafficInfo() {
        if (!this.trafficManager) return null;
        
        const baseInfo = this.trafficManager.getTrafficInfo();
        
        // Add driver-specific information
        const driversOnRoad = this.trafficManager.vehicles.map(vehicle => ({
            name: vehicle.driverData?.['dueño'] || 'Unknown',
            level: vehicle.driverData?.['nivel de conduccion'] || 0,
            plate: vehicle.driverData?.placa || 'Unknown',
            type: vehicle.type,
            isEmergencyLaneChange: vehicle.isEmergencyLaneChange || false,
            isReturningToTraffic: vehicle.isReturningToTraffic || false,
            emergencySlowDown: vehicle.emergencySlowDown || false
        }));

        // Add emergency system status
        const emergencyStatus = this.emergencyLaneChangeManager?.getStatus() || null;

        return {
            ...baseInfo,
            driversOnRoad,
            totalDriversLoaded: window.driverDataManager?.drivers.length || 0,
            emergencySystem: emergencyStatus
        };
    }

    // Debug methods for testing
    getEmergencyStatus() {
        return this.emergencyLaneChangeManager?.getStatus() || null;
    }

    forceEmergencyScenario() {
        if (this.emergencyLaneChangeManager && this.trafficManager.vehicles.length >= 2) {
            console.log('🚨 Forcing emergency scenario for testing...');
            this.emergencyLaneChangeManager.isBlocked = true;
            this.emergencyLaneChangeManager.blockingVehicles = this.trafficManager.vehicles.slice(0, 2);
            this.emergencyLaneChangeManager.initiateEmergencyLaneChange();
        } else {
            console.log('❌ Cannot force emergency: insufficient vehicles or system not ready');
        }
    }

    // Method to simulate blocking scenario with specific vehicles
    createBlockingScenario() {
        if (!this.trafficManager || this.trafficManager.vehicles.length < 2) {
            console.log('Not enough vehicles to create blocking scenario');
            return;
        }

        // Position two vehicles directly in front of ambulance
        const ambulancePos = this.ambulance.mesh.position;
        const ambulanceSegment = this.ambulance.currentWaypointIndex || 0;
        
        // Get two vehicles to position as blockers
        const leftBlocker = this.trafficManager.vehicles[0];
        const rightBlocker = this.trafficManager.vehicles[1];

        // Position them ahead of ambulance
        leftBlocker.currentSegment = ambulanceSegment + 1;
        leftBlocker.progress = 0.5;
        leftBlocker.laneOffset = -1.2; // Left lane
        
        rightBlocker.currentSegment = ambulanceSegment + 1;
        rightBlocker.progress = 0.6;
        rightBlocker.laneOffset = 1.2; // Right lane

        // Slow them down
        leftBlocker.currentSpeed = 0.5;
        rightBlocker.currentSpeed = 0.5;

        console.log('🚧 Blocking scenario created with:', {
            leftBlocker: leftBlocker.driverData['dueño'],
            rightBlocker: rightBlocker.driverData['dueño']
        });
    }
}


class GameWithEmergencyLaneChange extends Game {
    constructor(routeData) {
        super(routeData);
        
        // Initialize emergency lane change system after traffic is set up
        setTimeout(() => {
            if (this.trafficManager && this.ambulance) {
                this.emergencyLaneChangeManager = new EmergencyLaneChangeManager(
                    this.trafficManager, 
                    this.ambulance
                );
                console.log('Emergency lane change system initialized');
            }
        }, 1000);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const deltaTime = this.clock.getDelta();
        
        // Update game objects
        this.ambulance.update(this.inputManager, this.waypoints);
        recordSpeedSample(this.ambulance.speed);
        
        // Update camera
        this.gameScene.updateCamera(this.ambulance);
        
        // Update UI
        this.uiManager.updateUI(
            this.ambulance.currentWaypointIndex, 
            this.ambulance.stepProgress, 
            this.ambulance.speed
        );
        
        // Update traffic vehicles
        const playerSegment = this.ambulance.currentWaypointIndex || 0;
        if (this.trafficManager) {
            this.trafficManager.update(deltaTime, playerSegment);
        }

        // Update emergency lane change system
        if (this.emergencyLaneChangeManager) {
            this.emergencyLaneChangeManager.update(deltaTime);
        }

        // Render scene
        this.gameScene.render();
    }

    // Debug methods
    getEmergencyStatus() {
        return this.emergencyLaneChangeManager?.getStatus() || null;
    }

    forceEmergencyScenario() {
        // Debug method to force an emergency scenario
        if (this.emergencyLaneChangeManager) {
            this.emergencyLaneChangeManager.isBlocked = true;
            this.emergencyLaneChangeManager.blockingVehicles = this.trafficManager.vehicles.slice(0, 2);
            this.emergencyLaneChangeManager.initiateEmergencyLaneChange();
        }
    }
}

// // Export enhanced classes
// window.EmergencyLaneChangeManager = EmergencyLaneChangeManager;
// window.EnhancedTrafficVehicleWithDriver = EnhancedTrafficVehicleWithDriver;
// window.GameWithEmergencyLaneChange = GameWithEmergencyLaneChange;