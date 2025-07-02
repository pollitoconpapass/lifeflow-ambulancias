class TrafficVehicle {
    constructor(scene, routePoints, options = {}) {
        this.scene = scene;
        this.routePoints = routePoints;
        this.type = options.type || "car"; // "car", "truck", or "bus"
        this.currentSegment = Math.floor(Math.random() * (routePoints.length - 2));
        this.progress = Math.random();
        
        // More realistic speed variations
        this.baseSpeed = this.getRealisticSpeed();
        this.currentSpeed = this.baseSpeed;
        this.maxSpeed = this.baseSpeed * 1.3;
        this.acceleration = 0.002;
        this.deceleration = 0.005;
        
        this.laneOffset = (options.laneOffset !== undefined) ? options.laneOffset : (Math.random() - 0.5) * 2.5;

        // Realistic behavior properties
        this.aggressiveness = Math.random(); // 0 = cautious, 1 = aggressive
        this.followDistance = 8 + Math.random() * 12; // meters
        this.brakingDistance = 15 + Math.random() * 10;
        this.isChangingLanes = false;
        this.laneChangeProgress = 0;
        this.targetLaneOffset = this.laneOffset;
        this.originalLaneOffset = this.laneOffset;
        
        // Turning and physics
        this.velocity = new THREE.Vector3();
        this.previousPosition = new THREE.Vector3();
        this.wheelRotation = 0;
        this.steeringAngle = 0;
        this.maxSteeringAngle = Math.PI / 6; // 30 degrees
        
        // Lighting
        this.headlights = [];
        this.taillights = [];

        // Color variety with more realistic colors
        let color = options.color;
        if (!color) {
            color = this.getRealisticColor();
        }

        this.wheels = [];  
        this.headlights = [];  
        this.taillights = [];

        this.mesh = this.createMesh(color);
        scene.add(this.mesh);
        
        // Store wheels for animation
        this.extractWheels(this.mesh);
    }

    getRealisticSpeed() {
        // Speed in units per second (roughly m/s equivalent)
        switch(this.type) {
            case "bus": return 1.5 + Math.random() * 1; // Slower, 1.5-2.5
            case "truck": return 1.8 + Math.random() * 0.8; // Medium, 1.8-2.6
            case "car": return 2.2 + Math.random() * 1.5; // Faster, 2.2-3.7
            default: return 2 + Math.random() * 2;
        }
    }

    getRealisticColor() {
        if (this.type === "bus") {
            const busColors = [0x0073cf, 0xff6b35, 0x2e8b57, 0x8b0000, 0xffd700];
            return busColors[Math.floor(Math.random() * busColors.length)];
        } else if (this.type === "truck") {
            const truckColors = [0xffffff, 0x333333, 0x8b0000, 0x0f4c81, 0x2f4f2f];
            return truckColors[Math.floor(Math.random() * truckColors.length)];
        } else {
            // Realistic car colors distribution
            const carColors = [
                0xffffff, 0xffffff, 0xffffff, // White (most common)
                0x000000, 0x000000, // Black
                0x708090, 0x696969, // Gray/Silver
                0x8b0000, 0xff0000, // Red
                0x000080, 0x0f4c81, // Blue
                0x2f4f2f, 0x228b22 // Green
            ];
            return carColors[Math.floor(Math.random() * carColors.length)];
        }
    }

    createMesh(color) {
        const group = new THREE.Group();

        if (this.type === "bus") {
            this.createBus(group, color);
        } else if (this.type === "truck") {
            this.createTruck(group, color);
        } else {
            this.createCar(group, color);
        }

        // Add headlights and taillights
        this.addLights(group);

        group.castShadow = true;
        group.receiveShadow = true;
        return group;
    }

    createBus(group, color) {
        // Main body with more detail - elevated to sit above road
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(2.2, 1.6, 8.5),
            new THREE.MeshLambertMaterial({ color })
        );
        body.position.y = 1.25; // Elevated: road(0.05) + wheel_radius(0.4) + half_body_height(0.8)
        group.add(body);

        // Windows
        const windowGeometry = new THREE.BoxGeometry(2.1, 0.6, 7.5);
        const windows = new THREE.Mesh(
            windowGeometry,
            new THREE.MeshLambertMaterial({ color: 0x87ceeb, transparent: true, opacity: 0.7 })
        );
        windows.position.y = 1.75; // Adjusted relative to new body position
        group.add(windows);

        // Door
        const door = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 1.2, 1.2),
            new THREE.MeshLambertMaterial({ color: 0x444444 })
        );
        door.position.set(1.15, 1.05, 2); // Adjusted relative to new body position
        group.add(door);

        // FIXED: Position wheels to touch road surface (road Y = 0.05, so wheel center = 0.05 + radius)
        this.addWheels(group, 0.45, [-3, 3], 0.4);
    }

    createTruck(group, color) {
        // Cab - elevated to sit above road
        const cab = new THREE.Mesh(
            new THREE.BoxGeometry(2.2, 1.8, 2.5),
            new THREE.MeshLambertMaterial({ color: 0x444444 })
        );
        cab.position.set(0, 1.4, -3.5); // Elevated: road(0.05) + wheel_radius(0.5) + half_cab_height(0.9)
        group.add(cab);

        // Cab windows
        const cabWindows = new THREE.Mesh(
            new THREE.BoxGeometry(2.1, 0.8, 2.3),
            new THREE.MeshLambertMaterial({ color: 0x87ceeb, transparent: true, opacity: 0.7 })
        );
        cabWindows.position.set(0, 1.85, -3.5); // Adjusted relative to new cab position
        group.add(cabWindows);

        // Trailer - elevated to sit above road
        const trailer = new THREE.Mesh(
            new THREE.BoxGeometry(2.3, 2.2, 7),
            new THREE.MeshLambertMaterial({ color })
        );
        trailer.position.set(0, 1.65, 1); // Elevated: road(0.05) + wheel_radius(0.5) + half_trailer_height(1.1)
        group.add(trailer);

        // Trailer doors
        const doors = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 2, 6.8),
            new THREE.MeshLambertMaterial({ color: 0x333333 })
        );
        doors.position.set(-1.2, 1.65, 1); // Adjusted relative to new trailer position
        group.add(doors);

        // FIXED: Position wheels to touch road surface (road Y = 0.05, so wheel center = 0.05 + radius)
        this.addWheels(group, 0.55, [-2.5, 0.5, 2.5], 0.5);
    }

    createCar(group, color) {
        // Main body - elevated to sit above road
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(1.7, 0.8, 4),
            new THREE.MeshLambertMaterial({ color })
        );
        body.position.y = 0.75; // Elevated: road(0.05) + wheel_radius(0.3) + half_body_height(0.4)
        group.add(body);

        // Cabin/roof
        const cabin = new THREE.Mesh(
            new THREE.BoxGeometry(1.5, 0.6, 2.2),
            new THREE.MeshLambertMaterial({ color: color })
        );
        cabin.position.set(0, 1.25, 0.2); // Adjusted relative to new body position
        group.add(cabin);

        // Windows
        const windows = new THREE.Mesh(
            new THREE.BoxGeometry(1.4, 0.5, 2),
            new THREE.MeshLambertMaterial({ color: 0x87ceeb, transparent: true, opacity: 0.6 })
        );
        windows.position.set(0, 1.3, 0.2); // Adjusted relative to new cabin position
        group.add(windows);

        // Bumpers
        const frontBumper = new THREE.Mesh(
            new THREE.BoxGeometry(1.8, 0.2, 0.3),
            new THREE.MeshLambertMaterial({ color: 0x333333 })
        );
        frontBumper.position.set(0, 0.45, 2.15); // Adjusted relative to new body position
        group.add(frontBumper);

        const rearBumper = new THREE.Mesh(
            new THREE.BoxGeometry(1.8, 0.2, 0.3),
            new THREE.MeshLambertMaterial({ color: 0x333333 })
        );
        rearBumper.position.set(0, 0.45, -2.15); // Adjusted relative to new body position
        group.add(rearBumper);

        // Car wheels positioned to touch road surface
        this.addWheels(group, 0.35, [-1.4, 1.4], 0.3);
    }

    addWheels(group, y, zPositions, radius = 0.3) {
        const wheelGeometry = new THREE.CylinderGeometry(radius, radius, 0.2, 16);
        const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });
        const rimMaterial = new THREE.MeshLambertMaterial({ color: 0x888888 });

        for (let z of zPositions) {
            for (let x of [-0.9, 0.9]) {
                const wheelGroup = new THREE.Group();
                
                // Tire
                const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
                wheel.rotation.z = Math.PI / 2;
                wheelGroup.add(wheel);
                
                // Rim
                const rim = new THREE.Mesh(
                    new THREE.CylinderGeometry(radius * 0.7, radius * 0.7, 0.05, 8),
                    rimMaterial
                );
                rim.rotation.z = Math.PI / 2;
                wheelGroup.add(rim);

                wheelGroup.position.set(x, y, z);
                group.add(wheelGroup);
                this.wheels.push(wheelGroup);
            }
        }
    }

    addLights(group) {
        const headlightGeometry = new THREE.SphereGeometry(0.15, 8, 8);
        const headlightMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xffffcc, 
            emissive: 0x333311 
        });

        const taillightGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        const taillightMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xff4444, 
            emissive: 0x220000 
        });

        // Position lights based on vehicle type
        let frontZ, rearZ, lightY;
        switch(this.type) {
            case "bus":
                frontZ = 4.2; rearZ = -4.2; lightY = 0.6;
                break;
            case "truck":
                frontZ = -2.2; rearZ = 4.5; lightY = 0.8;
                break;
            default: // car
                frontZ = 2; rearZ = -2; lightY = 0.4;
        }

        // Headlights
        for (let x of [-0.6, 0.6]) {
            const headlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
            headlight.position.set(x, lightY, frontZ);
            group.add(headlight);
            this.headlights.push(headlight);
        }

        // Taillights
        for (let x of [-0.5, 0.5]) {
            const taillight = new THREE.Mesh(taillightGeometry, taillightMaterial);
            taillight.position.set(x, lightY, rearZ);
            group.add(taillight);
            this.taillights.push(taillight);
        }
    }

    extractWheels(group) {
        // Find and store wheel references for rotation animation
        group.traverse((child) => {
            if (child.isMesh && child.geometry.type === 'CylinderGeometry') {
                // This is likely a wheel
                if (child.parent && child.parent !== group) {
                    if (!this.wheels.includes(child.parent)) {
                        this.wheels.push(child.parent);
                    }
                }
            }
        });
    }

    update(deltaTime = 0.016, nearbyVehicles = []) {
        if (this.currentSegment >= this.routePoints.length - 1) return;

        const from = this.routePoints[this.currentSegment];
        const to = this.routePoints[this.currentSegment + 1];
        const direction = new THREE.Vector3().subVectors(to, from).normalize();
        const segmentLength = from.distanceTo(to);

        // Traffic behavior - slow down if vehicle ahead
        this.adjustSpeedForTraffic(nearbyVehicles);

        // Update position
        this.progress += this.currentSpeed * deltaTime / segmentLength;
        
        if (this.progress > 1) {
            this.currentSegment++;
            this.progress = 0;
            if (this.currentSegment >= this.routePoints.length - 1) return;
        }

        // Calculate new position
        const newPosition = from.clone().lerp(to, this.progress);
        
        // Handle lane changes
        this.updateLaneChange(deltaTime);
        
        // Apply lane offset
        const perp = new THREE.Vector3(-direction.z, 0, direction.x);
        newPosition.add(perp.multiplyScalar(this.laneOffset));
        
        // Calculate velocity for realistic physics
        this.velocity.subVectors(newPosition, this.mesh.position);
        this.previousPosition.copy(this.mesh.position);
        this.mesh.position.copy(newPosition);

        // Smooth steering based on road curvature
        this.updateSteering(direction, deltaTime);

        // Orient vehicle to match road direction (same as road rotation calculation)
        this.mesh.rotation.y = Math.atan2(direction.x, direction.z);
        this.mesh.rotation.x = 0;
        this.mesh.rotation.z = this.steeringAngle * 0.1; // Slight banking

        // Animate wheels
        this.animateWheels(deltaTime);

        // Update lights based on conditions (could be expanded)
        this.updateLights();
    }

    adjustSpeedForTraffic(nearbyVehicles) {
        let targetSpeed = this.baseSpeed;
        
        for (let vehicle of nearbyVehicles) {
            if (vehicle === this) continue;
            
            const distance = this.mesh.position.distanceTo(vehicle.mesh.position);
            const relativePosition = vehicle.mesh.position.clone().sub(this.mesh.position);
            
            // Check if vehicle is in front and in same lane
            const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
            const dot = relativePosition.normalize().dot(forward);
            
            if (dot > 0.7 && distance < this.followDistance) {
                // Vehicle ahead - slow down
                const slowFactor = Math.max(0.3, distance / this.followDistance);
                targetSpeed = this.baseSpeed * slowFactor;
            }
        }

        // Smooth speed transitions
        if (this.currentSpeed < targetSpeed) {
            this.currentSpeed = Math.min(targetSpeed, this.currentSpeed + this.acceleration);
        } else if (this.currentSpeed > targetSpeed) {
            this.currentSpeed = Math.max(targetSpeed, this.currentSpeed - this.deceleration);
        }
    }

    updateLaneChange(deltaTime) {
        if (this.isChangingLanes) {
            this.laneChangeProgress += deltaTime * 0.5; // Lane change speed
            
            if (this.laneChangeProgress >= 1) {
                this.laneChangeProgress = 1;
                this.isChangingLanes = false;
                this.originalLaneOffset = this.targetLaneOffset;
            }
            
            // Smooth interpolation
            const t = this.smoothStep(this.laneChangeProgress);
            this.laneOffset = this.originalLaneOffset + 
                (this.targetLaneOffset - this.originalLaneOffset) * t;
        } else if (Math.random() < 0.0001 * this.aggressiveness) {
            // Occasionally change lanes (very rarely)
            this.initiateLaneChange();
        }
    }

    initiateLaneChange() {
        const newLane = (Math.random() - 0.5) * 2.5;
        if (Math.abs(newLane - this.laneOffset) > 1) {
            this.isChangingLanes = true;
            this.laneChangeProgress = 0;
            this.targetLaneOffset = newLane;
        }
    }

    updateSteering(direction, deltaTime) {
        // Calculate steering angle based on direction change
        const currentYaw = this.mesh.rotation.y;
        const targetYaw = Math.atan2(direction.x, direction.z);
        
        // Handle angle wrapping (shortest path)
        let angleDiff = targetYaw - currentYaw;
        if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        
        this.steeringAngle = Math.sign(angleDiff) * Math.min(this.maxSteeringAngle, 
            Math.abs(angleDiff));
    }

    animateWheels(deltaTime) {
        // Rotate wheels based on speed
        this.wheelRotation += this.currentSpeed * deltaTime * 2;
        
        for (let wheel of this.wheels) {
            if (wheel && wheel.rotation) {
                wheel.rotation.x = this.wheelRotation;
            }
        }
    }

    updateLights() {
        // Could add day/night cycle, brake lights, turn signals etc.
        const time = Date.now() * 0.001;
        const brightness = 0.8 + 0.2 * Math.sin(time * 0.5); // Subtle light variation
        
        for (let light of this.headlights) {
            light.material.emissive.setScalar(0.1 * brightness);
        }
    }

    smoothStep(t) {
        // Smooth interpolation function
        return t * t * (3 - 2 * t);
    }

    dispose() {
        if (this.mesh && this.mesh.parent) {
            this.mesh.parent.remove(this.mesh);
        }
    }
}

class TrafficVehicleWithDriver extends TrafficVehicle {
    constructor(scene, routePoints, options = {}, driverData = null) {
        super(scene, routePoints, options);
        
        // Driver information
        this.driverData = driverData || {
            placa: 'UNK000',
            'dueño': 'Unknown Driver',
            'nivel de conduccion': 50
        };
        
        // Create driver info display
        this.driverDisplay = this.createDriverDisplay();
        scene.add(this.driverDisplay);
        
        // Adjust behavior based on driving level
        this.adjustBehaviorByDrivingLevel();
    }

    createDriverDisplay() {
        const group = new THREE.Group();
        
        // Create canvas for text
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 256;
        
        // Clear canvas
        context.fillStyle = 'rgba(0, 0, 0, 0.7)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Set text properties
        context.font = 'bold 36px Arial';
        context.textAlign = 'center';
        context.fillStyle = '#ffffff';
        
        // Draw owner name
        const ownerName = this.driverData['dueño'] || 'Unknown';
        context.fillText(ownerName, canvas.width / 2, 80);
        
        // Draw driving level with color coding
        const drivingLevel = this.driverData['nivel de conduccion'] || 0;
        const levelColor = this.getDrivingLevelColor(drivingLevel);
        context.fillStyle = levelColor;
        context.font = 'bold 48px Arial';
        context.fillText(`Level: ${drivingLevel}`, canvas.width / 2, 140);
        
        // Draw license plate
        context.fillStyle = '#cccccc';
        context.font = 'bold 24px Arial';
        context.fillText(this.driverData.placa || 'UNK000', canvas.width / 2, 180);
        
        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        
        // Create sprite
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true,
            alphaTest: 0.1
        });
        
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(4, 2, 1); // Adjust size as needed
        sprite.position.y = 3; // Position above vehicle
        
        group.add(sprite);
        return group;
    }

    getDrivingLevelColor(level) {
        if (level >= 75) return '#00ff00'; // Green
        if (level >= 50) return '#ffff00'; // Yellow
        return '#ff0000'; // Red
    }

    adjustBehaviorByDrivingLevel() {
        const level = this.driverData['nivel de conduccion'] || 50;
        
        // Adjust vehicle behavior based on driving skill
        if (level >= 75) {
            // Excellent drivers: smooth, predictable
            this.aggressiveness = 0.3; // Less aggressive
            this.followDistance *= 1.2; // Maintain better distance
            this.acceleration *= 1.1; // Slightly better acceleration
            this.maxSpeed *= 1.05; // Slightly faster
        } else if (level >= 50) {
            // Average drivers: normal behavior
            // Keep default values
        } else {
            // Poor drivers: erratic, slower
            this.aggressiveness = 0.8; // More erratic
            this.followDistance *= 0.8; // Follow too closely
            this.acceleration *= 0.8; // Slower acceleration
            this.maxSpeed *= 0.9; // Drive slower
            this.deceleration *= 1.3; // Brake harder
        }
    }

    update(deltaTime = 0.016, nearbyVehicles = []) {
        // Call parent update
        super.update(deltaTime, nearbyVehicles);
        
        // Update driver display position to follow vehicle
        if (this.driverDisplay) {
            this.driverDisplay.position.copy(this.mesh.position);
            this.driverDisplay.position.y += 3; // Keep above vehicle
            
            // Make sprite face camera (billboard effect)
            if (this.scene && this.scene.camera) {
                this.driverDisplay.lookAt(this.scene.camera.position);
            }
        }
    }

    dispose() {
        // Clean up driver display
        if (this.driverDisplay && this.driverDisplay.parent) {
            this.driverDisplay.parent.remove(this.driverDisplay);
        }
        
        // Release driver for reuse
        if (window.driverDataManager) {
            window.driverDataManager.releaseDriver(this.driverData.placa);
        }
        
        // Call parent dispose
        super.dispose();
    }
}

class EnhancedTrafficVehicleWithDriver extends TrafficVehicleWithDriver {
    constructor(scene, routePoints, options = {}, driverData = null) {
        super(scene, routePoints, options, driverData);
        
        // Emergency lane change properties
        this.isEmergencyLaneChange = false;
        this.isReturningToTraffic = false;
        this.emergencyLaneChangeProgress = 0;
        this.originalLaneOffset = this.laneOffset;
        this.emergencyTargetOffset = 0;
        this.emergencySlowDown = false;
        this.originalCurrentSpeed = this.currentSpeed;
    }

    update(deltaTime = 0.016, nearbyVehicles = []) {
        // Handle emergency behaviors first
        if (this.emergencySlowDown && !this.isEmergencyLaneChange) {
            // Maintain slower speed during emergency situations
            this.currentSpeed = Math.min(this.currentSpeed, this.baseSpeed * 0.3);
        }

        // Call parent update
        super.update(deltaTime, nearbyVehicles);
        
        // Update emergency lane change visual indicators
        if (this.isEmergencyLaneChange || this.isReturningToTraffic) {
            this.updateEmergencyVisuals();
        }
    }

    updateEmergencyVisuals() {
        // Add visual indicators for emergency lane changes
        if (this.taillights && this.taillights.length > 0) {
            // Flash hazard lights during emergency maneuver
            const flashRate = Date.now() * 0.01;
            const intensity = 0.5 + 0.5 * Math.sin(flashRate);
            
            this.taillights.forEach(light => {
                light.material.emissive.setScalar(intensity * 0.3);
            });
            
            this.headlights.forEach(light => {
                light.material.emissive.setScalar(intensity * 0.1);
            });
        }
    }
}
