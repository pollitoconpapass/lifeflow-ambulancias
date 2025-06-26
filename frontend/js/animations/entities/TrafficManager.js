class TrafficManager {
    constructor(scene, routePoints) {
        this.scene = scene;
        this.routePoints = routePoints;
        this.vehicles = [];
        this.maxVehicles = 200; // Maximum vehicles on screen
        this.spawnTimer = 0;
        this.spawnInterval = 1000; // Base spawn interval in milliseconds
        
        // Traffic patterns for different times and days
        this.trafficPatterns = {
            // Weekday patterns (Monday-Friday)
            weekday: {
                rushHourMorning: { start: 7, end: 9, intensity: 0.9, interval: 800 },
                midMorning: { start: 9, end: 11, intensity: 0.4, interval: 2500 },
                lunch: { start: 11, end: 14, intensity: 0.6, interval: 1800 },
                afternoon: { start: 14, end: 17, intensity: 0.5, interval: 2200 },
                rushHourEvening: { start: 17, end: 19, intensity: 0.95, interval: 700 },
                evening: { start: 19, end: 22, intensity: 0.3, interval: 3000 },
                night: { start: 22, end: 24, intensity: 0.1, interval: 8000 },
                lateNight: { start: 0, end: 6, intensity: 0.05, interval: 12000 },
                earlyMorning: { start: 6, end: 7, intensity: 0.2, interval: 4000 }
            },
            // Weekend patterns (Saturday-Sunday)
            weekend: {
                night: { start: 0, end: 8, intensity: 0.08, interval: 10000 },
                morning: { start: 8, end: 11, intensity: 0.25, interval: 3500 },
                midday: { start: 11, end: 14, intensity: 0.4, interval: 2500 },
                afternoon: { start: 14, end: 18, intensity: 0.6, interval: 1800 },
                evening: { start: 18, end: 22, intensity: 0.7, interval: 1500 },
                lateEvening: { start: 22, end: 24, intensity: 0.3, interval: 3000 }
            }
        };
        
        // Special day multipliers
        this.specialDays = {
            friday: { evening: 1.5 }, // Friday night traffic
            sunday: { overall: 0.7 }   // Generally quieter Sundays
        };
    }
    
    getCurrentTrafficPattern() {
        const now = new Date();
        const hour = now.getHours();
        const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        let patterns = isWeekend ? this.trafficPatterns.weekend : this.trafficPatterns.weekday;
        let currentPattern = null;
        
        // Find the current time pattern
        for (let [name, pattern] of Object.entries(patterns)) {
            if (hour >= pattern.start && hour < pattern.end) {
                currentPattern = { ...pattern, name };
                break;
            }
        }
        
        // Apply special day modifiers
        if (!isWeekend) {
            switch (dayOfWeek) {
                case 5: // Friday
                    if (hour >= 17 && hour < 22) {
                        currentPattern.intensity *= (this.specialDays.friday.evening || 1);
                        currentPattern.interval *= 0.8; // More frequent spawning
                    }
                    break;
            }
        } else if (dayOfWeek === 0) { // Sunday
            currentPattern.intensity *= (this.specialDays.sunday.overall || 1);
            currentPattern.interval *= 1.2; // Less frequent spawning
        }
        
        return currentPattern || { 
            intensity: 0.1, 
            interval: 8000, 
            name: 'default' 
        };
    }
    
    getVehicleTypeDistribution() {
        const now = new Date();
        const hour = now.getHours();
        const dayOfWeek = now.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        let distribution = { car: 0.75, truck: 0.15, bus: 0.1 };
        
        if (!isWeekend) {
            // Weekday adjustments
            if (hour >= 7 && hour <= 9) {
                // Morning rush: more cars, some buses
                distribution = { car: 0.8, truck: 0.05, bus: 0.15 };
            } else if (hour >= 17 && hour <= 19) {
                // Evening rush: more cars
                distribution = { car: 0.85, truck: 0.05, bus: 0.1 };
            } else if (hour >= 10 && hour <= 16) {
                // Daytime: more trucks for deliveries
                distribution = { car: 0.65, truck: 0.25, bus: 0.1 };
            }
        } else {
            // Weekend adjustments
            if (hour >= 10 && hour <= 18) {
                // Weekend leisure time: mostly cars
                distribution = { car: 0.9, truck: 0.05, bus: 0.05 };
            }
        }
        
        return distribution;
    }

    populateInitialTraffic(playerStartSegment = 0) {
        const pattern = this.getCurrentTrafficPattern();
        const baseVehicleCount = Math.floor(this.maxVehicles * pattern.intensity);
        const vehicleCount = Math.max(3, Math.min(baseVehicleCount, this.maxVehicles));
        
        console.log(`Populating road with ${vehicleCount} initial vehicles (${Math.round(pattern.intensity * 100)}% intensity)`);
        
        for (let i = 0; i < vehicleCount; i++) {
            this.spawnInitialVehicle(playerStartSegment);
        }
    }

    spawnInitialVehicle(playerStartSegment) {
        const totalSegments = this.routePoints.length - 1;
        let segment, progress;
        
        // Create vehicles distributed across the route, avoiding player start area
        const avoidanceZone = 5; // segments to avoid around player
        
        do {
            segment = Math.floor(Math.random() * totalSegments);
            progress = Math.random();
        } while (Math.abs(segment - playerStartSegment) < avoidanceZone);
        
        this.spawnVehicle(segment, progress);
    }

    getSpawnSegment(playerSegment) {
        const totalSegments = this.routePoints.length - 1;
        const spawnDistance = 8; // minimum segments away from player
        
        // Prefer spawning behind player (realistic for following traffic)
        if (playerSegment > spawnDistance) {
            // Spawn behind player
            const minBehind = Math.max(0, playerSegment - 20);
            const maxBehind = Math.max(0, playerSegment - spawnDistance);
            if (maxBehind > minBehind) {
                return Math.floor(Math.random() * (maxBehind - minBehind)) + minBehind;
            }
        }
        
        // If can't spawn behind, spawn far ahead
        if (playerSegment + spawnDistance < totalSegments) {
            const minAhead = playerSegment + spawnDistance;
            const maxAhead = Math.min(totalSegments - 1, playerSegment + 25);
            if (maxAhead > minAhead) {
                return Math.floor(Math.random() * (maxAhead - minAhead)) + minAhead;
            }
        }
        
        return null; // Can't spawn safely
    }

    spawnVehicleAtSegment(segment) {
        const type = this.selectVehicleType();
        const options = {
            type: type,
            laneOffset: (Math.random() - 0.5) * 2.5
        };
        
        const vehicle = new TrafficVehicle(this.scene, this.routePoints, options);
        vehicle.currentSegment = segment;
        vehicle.progress = Math.random();
        
        this.vehicles.push(vehicle);
        console.log(`Spawned ${type} at segment ${segment}`);
    }
    
    shouldSpawnVehicle(deltaTime, playerSegment = 0) {
        if (this.vehicles.length >= this.maxVehicles) return false;
        
        const pattern = this.getCurrentTrafficPattern();
        this.spawnTimer += deltaTime * 1000; // Convert to milliseconds
        
        // Add some randomness to make it feel more natural
        const randomFactor = 0.7 + Math.random() * 0.6; // 0.7 to 1.3
        const adjustedInterval = pattern.interval * randomFactor;
        
        if (this.spawnTimer >= adjustedInterval) {
            this.spawnTimer = 0;
            
            // Only spawn if we're not too close to the player
            // Spawn behind player or far ahead
            const spawnSegment = this.getSpawnSegment(playerSegment);
            if (spawnSegment !== null && Math.random() < pattern.intensity) {
                return spawnSegment;
            }
        }
        
        return false;
    }
    
    selectVehicleType() {
        const distribution = this.getVehicleTypeDistribution();
        const rand = Math.random();
        
        if (rand < distribution.car) return 'car';
        if (rand < distribution.car + distribution.truck) return 'truck';
        return 'bus';
    }
    
    spawnVehicle(forceSegment = null, forceProgress = null) {
        const type = this.selectVehicleType();
        const options = {
            type: type,
            laneOffset: (Math.random() - 0.5) * 2.5
        };
        
        const vehicle = new TrafficVehicle(this.scene, this.routePoints, options);
        
        // If specific position is requested, override the random position
        if (forceSegment !== null && forceProgress !== null) {
            vehicle.currentSegment = forceSegment;
            vehicle.progress = forceProgress;
        }
        
        this.vehicles.push(vehicle);
        
        console.log(`Spawned ${type} at ${new Date().toLocaleTimeString()}`);
        return vehicle;
    }
    
    update(deltaTime, playerSegment = 0) {
        // Update existing vehicles
        for (let i = this.vehicles.length - 1; i >= 0; i--) {
            const vehicle = this.vehicles[i];
            vehicle.update(deltaTime, this.vehicles);
            
            // Remove vehicles that have completed their route
            if (vehicle.currentSegment >= vehicle.routePoints.length - 1) {
                vehicle.dispose();
                this.vehicles.splice(i, 1);
            }
        }
        
        // Spawn new vehicles based on time patterns, avoiding player area
        const spawnSegment = this.shouldSpawnVehicle(deltaTime, playerSegment);
        if (spawnSegment !== false) {
            this.spawnVehicleAtSegment(spawnSegment);
        }
    }
    
    // Debug method to show current traffic info
    getTrafficInfo() {
        const pattern = this.getCurrentTrafficPattern();
        const now = new Date();
        return {
            time: now.toLocaleTimeString(),
            day: now.toLocaleDateString('en-US', { weekday: 'long' }),
            pattern: pattern.name,
            intensity: Math.round(pattern.intensity * 100) + '%',
            vehicles: this.vehicles.length,
            nextSpawn: Math.max(0, Math.round((pattern.interval - this.spawnTimer) / 1000)) + 's'
        };
    }
    
    // Method to simulate different times for testing
    simulateTime(hour, dayOfWeek) {
        const testDate = new Date();
        testDate.setHours(hour);
        testDate.setDay(dayOfWeek);
        
        // Temporarily override Date for testing
        const originalDate = Date;
        global.Date = function() {
            return testDate;
        };
        global.Date.now = originalDate.now;
        
        const pattern = this.getCurrentTrafficPattern();
        
        // Restore original Date
        global.Date = originalDate;
        
        return pattern;
    }
}