class Ambulance {
    constructor(scene, startPosition) {
        this.scene = scene;
        this.mesh = this.createVehicleMesh();
        this.mesh.position.copy(startPosition);
        this.mesh.position.y = 0.1;
        this.scene.add(this.mesh);
        
        // Physics properties
        this.speed = 0;
        this.maxSpeed = 30;
        this.acceleration = 0;
        this.steering = 0;
        this.currentWaypointIndex = 0;
        this.stepProgress = 0;
        
        // Emergency lights properties
        this.emergencyLights = [];
        this.lightBlinkTimer = 0;
        this.lightBlinkSpeed = 0.5; // Controls blink frequency
        this.lightsOn = true;

        this.routeCompleted = false
    }

    createVehicleMesh() {
        const ambulanceGroup = new THREE.Group();
        
        // Ambulance body (white)
        const bodyGeometry = new THREE.BoxGeometry(2, 0.8, 4);
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.4;
        body.castShadow = true;
        ambulanceGroup.add(body);
        
        // Red cross on the side
        const crossGeometry = new THREE.BoxGeometry(0.1, 0.6, 0.1);
        const crossMaterial = new THREE.MeshLambertMaterial({ color: 0xFF0000 });
        
        // Vertical part of cross
        const crossVertical = new THREE.Mesh(crossGeometry, crossMaterial);
        crossVertical.position.set(1.05, 0.4, 0);
        crossVertical.scale.set(1, 1, 4);
        ambulanceGroup.add(crossVertical);
        
        // Horizontal part of cross
        const crossHorizontal = new THREE.Mesh(crossGeometry, crossMaterial);
        crossHorizontal.position.set(1.05, 0.4, 0);
        crossHorizontal.scale.set(1, 4, 1);
        ambulanceGroup.add(crossHorizontal);
        
        // Ambulance roof/cabin
        const roofGeometry = new THREE.BoxGeometry(1.8, 0.6, 2);
        const roofMaterial = new THREE.MeshLambertMaterial({ color: 0xF0F0F0 });
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.position.y = 1.1;
        roof.position.z = 1.2; // Front of ambulance
        roof.castShadow = true;
        ambulanceGroup.add(roof);
        
        // Emergency light bar on top
        const lightBarGeometry = new THREE.BoxGeometry(1.5, 0.2, 0.3);
        const lightBarMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
        const lightBar = new THREE.Mesh(lightBarGeometry, lightBarMaterial);
        lightBar.position.y = 1.5;
        lightBar.position.z = 1.2;
        ambulanceGroup.add(lightBar);
        
        // Create emergency lights
        this.createEmergencyLights(ambulanceGroup);
        
        // Wheels
        this.createWheels(ambulanceGroup);
        
        return ambulanceGroup;
    }

    createEmergencyLights(ambulanceGroup) {
        // Red and blue emergency lights on the light bar
        const lightGeometry = new THREE.SphereGeometry(0.15, 8, 6);
        
        // Red light (left side)
        const redLightMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xFF0000,
            emissive: 0xFF0000,
            emissiveIntensity: 0.3
        });
        const redLight = new THREE.Mesh(lightGeometry, redLightMaterial);
        redLight.position.set(-0.4, 1.6, 1.2);
        ambulanceGroup.add(redLight);
        
        // Blue light (right side)
        const blueLightMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x0000FF,
            emissive: 0x0000FF,
            emissiveIntensity: 0.3
        });
        const blueLight = new THREE.Mesh(lightGeometry, blueLightMaterial);
        blueLight.position.set(0.4, 1.6, 1.2);
        ambulanceGroup.add(blueLight);
        
        // Store references for blinking animation
        this.emergencyLights = [
            { mesh: redLight, material: redLightMaterial, baseColor: 0xFF0000, isRed: true },
            { mesh: blueLight, material: blueLightMaterial, baseColor: 0x0000FF, isRed: false }
        ];
        
        // Add point lights for illumination effect
        const redPointLight = new THREE.PointLight(0xFF0000, 2, 10);
        redPointLight.position.set(-0.4, 1.6, 1.2);
        ambulanceGroup.add(redPointLight);
        
        const bluePointLight = new THREE.PointLight(0x0000FF, 2, 10);
        bluePointLight.position.set(0.4, 1.6, 1.2);
        ambulanceGroup.add(bluePointLight);
        
        // Store point lights for blinking
        this.emergencyLights[0].pointLight = redPointLight;
        this.emergencyLights[1].pointLight = bluePointLight;
    }

    createWheels(ambulanceGroup) {
        const wheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8);
        const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
        
        const wheelPositions = [
            [-1.2, 0.3, 1.5],
            [1.2, 0.3, 1.5],
            [-1.2, 0.3, -1.5],
            [1.2, 0.3, -1.5]
        ];
        
        wheelPositions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.position.set(pos[0], pos[1], pos[2]);
            wheel.rotation.z = Math.PI / 2;
            wheel.castShadow = true;
            ambulanceGroup.add(wheel);
        });
    }

    updateEmergencyLights() {
        this.lightBlinkTimer += 0.016; // Assuming 60fps
        
        // Create alternating blink pattern
        const blinkCycle = Math.floor(this.lightBlinkTimer / this.lightBlinkSpeed) % 4;
        
        this.emergencyLights.forEach((light, index) => {
            let intensity = 0;
            let lightOn = false;
            
            // Alternating pattern: red blinks twice, then blue blinks twice
            if (light.isRed) {
                lightOn = (blinkCycle === 0 || blinkCycle === 1);
            } else {
                lightOn = (blinkCycle === 2 || blinkCycle === 3);
            }
            
            if (lightOn && this.lightsOn) {
                intensity = 0.8;
                light.pointLight.intensity = 3;
            } else {
                intensity = 0.1;
                light.pointLight.intensity = 0;
            }
            
            light.material.emissiveIntensity = intensity;
        });
    }

    update(inputManager, waypoints) {
        this.handleInput(inputManager, waypoints);
        this.updatePhysics(inputManager);
        this.followWaypoints(waypoints);
        this.updateEmergencyLights();
    }

    handleInput(inputManager, waypoints) {
        // Acceleration
        const forwardAccel = 0.1
        const reverseAccel = -0.08

        if (inputManager.isKeyPressed('KeyW')) {
            this.acceleration = forwardAccel;
        } else if (inputManager.isKeyPressed('KeyS')) {
            this.acceleration = reverseAccel;
        } else {
            this.acceleration = 0;
        }
        
        // Handbrake
        if (inputManager.isKeyPressed('Space')) {
            this.acceleration = 0;
        }
        
        // Steering
        const steeringStep = 0.005
        const maxSteering = 0.01
        if (inputManager.isKeyPressed('KeyA')) {
            this.steering = Math.max(this.steering - steeringStep, -maxSteering);
        } else if (inputManager.isKeyPressed('KeyD')) {
            this.steering = Math.min(this.steering + steeringStep, maxSteering);
        } else {
            this.steering *= 0.9;
        }
        
        // Toggle emergency lights with 'L' key
        if (inputManager.isKeyPressed('KeyL')) {
            this.lightsOn = !this.lightsOn;
        }
        
        // Reset
        if (inputManager.isKeyPressed('KeyR')) {
            this.reset(waypoints[0].from);
        }
    }

    updatePhysics(inputManager) {
        // Update speed
        this.speed += this.acceleration;
        this.speed = Math.max(-this.maxSpeed / 2, Math.min(this.speed, this.maxSpeed));

        if (inputManager.isKeyPressed('Space')) {
            if (this.speed > 0) {
                this.speed = Math.max(0, this.speed - 0.4);
            } else if (this.speed < 0) {
                this.speed = Math.min(0, this.speed + 0.4);
            }
        }
        
        // Apply steering
        const effectiveSpeed = Math.abs(this.speed);
        const minSteer = 0.05; // Minimum steering multiplier
        const speedSteerFactor = Math.max(effectiveSpeed / this.maxSpeed, minSteer); // Never below minSteer
        this.mesh.rotation.y -= this.steering * speedSteerFactor;
        
        // Move forward
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(this.mesh.quaternion);
        forward.multiplyScalar(this.speed * 0.016);
        this.mesh.position.add(forward);
    }

    followWaypoints(waypoints) {
        console.log(`Current waypoint index: ${this.currentWaypointIndex}, Total waypoints: ${waypoints.length}`);
        console.log(`Ambulance position:`, this.mesh.position);
        
        if (this.currentWaypointIndex >= waypoints.length) {
            console.log("🎉 ROUTE COMPLETED!");
            if (!this.routeCompleted) {
                this.routeCompleted = true;
                console.log("Calling onRouteCompleted...");
                if (typeof onRouteCompleted === 'function') {
                    onRouteCompleted(this, waypoints);
                } else {
                    console.log("onRouteCompleted function not found");
                }
            }
            return;
        }
        
        const currentWaypoint = waypoints[this.currentWaypointIndex];
        console.log(`Current waypoint:`, currentWaypoint);
        
        // Estrategia más inteligente para determinar el objetivo
        let targetPosition = currentWaypoint.to;
        let distanceToTarget = this.mesh.position.distanceTo(targetPosition);
        
        console.log(`Target position:`, targetPosition);
        console.log(`Distance to target: ${distanceToTarget}`);
        
        // Si la distancia es demasiado grande, buscar el waypoint más cercano
        if (distanceToTarget > 500) { // Si está a más de 500 unidades
            console.log("🔍 Distance too large, searching for closest waypoint...");
            
            let closestWaypointIndex = this.currentWaypointIndex;
            let closestDistance = distanceToTarget;
            
            // Buscar en los próximos 5 waypoints para encontrar el más cercano
            for (let i = this.currentWaypointIndex; i < Math.min(this.currentWaypointIndex + 5, waypoints.length); i++) {
                const distanceToFrom = this.mesh.position.distanceTo(waypoints[i].from);
                const distanceToTo = this.mesh.position.distanceTo(waypoints[i].to);
                
                if (distanceToFrom < closestDistance) {
                    closestDistance = distanceToFrom;
                    closestWaypointIndex = i;
                    targetPosition = waypoints[i].from;
                }
                
                if (distanceToTo < closestDistance) {
                    closestDistance = distanceToTo;
                    closestWaypointIndex = i;
                    targetPosition = waypoints[i].to;
                }
            }
            
            if (closestWaypointIndex !== this.currentWaypointIndex) {
                console.log(`📍 Skipping to closer waypoint ${closestWaypointIndex} (was ${this.currentWaypointIndex})`);
                this.currentWaypointIndex = closestWaypointIndex;
                distanceToTarget = closestDistance;
            }
        }
        
        // Usar distancia adaptativa basada en la velocidad
        let switchDistance = Math.max(15, Math.abs(this.speed) * 2); 
        
        // Si aún está muy lejos, usar una distancia más grande
        if (distanceToTarget > 200) {
            switchDistance = Math.max(switchDistance, 50);
        }
        
        console.log(`Using switch distance: ${switchDistance}`);
        
        if (distanceToTarget < switchDistance) {
            console.log(`✅ Reached waypoint ${this.currentWaypointIndex}! Moving to next...`);
            this.currentWaypointIndex++;
            this.stepProgress = 0;
            
            // Si llegamos al final, marcar como completado
            if (this.currentWaypointIndex >= waypoints.length) {
                console.log("🎯 Last waypoint reached!");
                if (!this.routeCompleted) {
                    this.routeCompleted = true;
                    if (typeof onRouteCompleted === 'function') {
                        onRouteCompleted(this, waypoints);
                    }
                }
            }
        } else {
            const totalDistance = currentWaypoint.from.distanceTo(currentWaypoint.to);
            let traveledDistance;
            
            // Si el total distance es muy pequeño o 0, usar distancia al objetivo
            if (totalDistance < 1) {
                const maxDistance = 100; // Asumir 100 unidades como máximo
                traveledDistance = Math.max(0, maxDistance - distanceToTarget);
                this.stepProgress = Math.min(100, (traveledDistance / maxDistance) * 100);
            } else {
                traveledDistance = this.mesh.position.distanceTo(currentWaypoint.from);
                this.stepProgress = Math.min(100, (traveledDistance / totalDistance) * 100);
            }
            
            console.log(`Progress: ${this.stepProgress.toFixed(1)}%`);
        }
    }

    debugWaypoints(waypoints) {
        for (let i = 0; i < Math.min(5, waypoints.length); i++) {
            const wp = waypoints[i];
            console.log(`Waypoint ${i}:`, {
                from: `(${wp.from.x.toFixed(1)}, ${wp.from.z.toFixed(1)})`,
                to: `(${wp.to.x.toFixed(1)}, ${wp.to.z.toFixed(1)})`,
                distance: wp.from.distanceTo(wp.to).toFixed(1),
                street: wp.streetName
            });
        }
        
        // Verificar conectividad
        for (let i = 0; i < waypoints.length - 1; i++) {
            const gap = waypoints[i].to.distanceTo(waypoints[i + 1].from);
            if (gap > 1) {
                console.warn(`⚠️ Gap detected between waypoint ${i} and ${i + 1}: ${gap.toFixed(1)} units`);
            }
        }
    }

    reset(startPosition) {
        this.mesh.position.copy(startPosition);
        this.mesh.position.y = 0.1;
        this.mesh.rotation.y = 0;
        this.speed = 0;
        this.acceleration = 0;
        this.currentWaypointIndex = 0;
        this.stepProgress = 0;
        this.lightBlinkTimer = 0;
        this.routeCompleted = false
    }
}