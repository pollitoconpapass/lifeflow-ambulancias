class EmergencyLaneChangeManager {
    constructor(trafficManager, ambulance) {
        this.trafficManager = trafficManager;
        this.ambulance = ambulance;
        this.isBlocked = false;
        this.blockingVehicles = [];
        this.isDecisionPending = false;
        this.selectedVehicle = null;
        
        // Configuration
        this.detectionDistance = 10; // meters ahead to check for blocking
        this.laneWidth = 2.5; // lane width for detection
        this.backendUrl = 'http://0.0.0.0:8082/change-lanes';
        
        // UI elements
        this.decisionUI = null;
        this.createDecisionUI();
        
        // Bind methods
        this.handleDriverSelection = this.handleDriverSelection.bind(this);
        this.handleRecommendedChoice = this.handleRecommendedChoice.bind(this);
    }

    createDecisionUI() {
        // Create UI container
        const uiContainer = document.createElement('div');
        uiContainer.id = 'lane-change-ui';
        uiContainer.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 20px;
            border-radius: 10px;
            font-family: Arial, sans-serif;
            z-index: 1000;
            display: none;
            max-width: 500px;
            text-align: center;
        `;

        const title = document.createElement('h2');
        title.textContent = 'Emergency Lane Change Required!';
        title.style.color = '#ff4444';
        title.style.marginBottom = '20px';
        uiContainer.appendChild(title);

        const subtitle = document.createElement('p');
        subtitle.textContent = 'Both lanes are blocked. Choose which driver should move aside:';
        subtitle.style.marginBottom = '20px';
        uiContainer.appendChild(subtitle);

        // Vehicles container
        const vehiclesContainer = document.createElement('div');
        vehiclesContainer.id = 'vehicles-container';
        vehiclesContainer.style.cssText = `
            display: flex;
            justify-content: space-around;
            margin: 20px 0;
        `;
        uiContainer.appendChild(vehiclesContainer);

        // Recommendation container
        const recommendationContainer = document.createElement('div');
        recommendationContainer.id = 'recommendation-container';
        recommendationContainer.style.cssText = `
            background: rgba(0, 255, 0, 0.2);
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            display: none;
        `;
        uiContainer.appendChild(recommendationContainer);

        // Buttons container
        const buttonsContainer = document.createElement('div');
        buttonsContainer.id = 'buttons-container';
        buttonsContainer.style.marginTop = '20px';
        uiContainer.appendChild(buttonsContainer);

        document.body.appendChild(uiContainer);
        this.decisionUI = uiContainer;
    }

    async checkForBlocking() {
        if (this.isDecisionPending) return;

        const ambulancePos = this.ambulance.mesh.position;
        const ambulanceSegment = this.ambulance.currentWaypointIndex || 0;
        
        // Find vehicles in front of ambulance
        const vehiclesAhead = this.trafficManager.vehicles.filter(vehicle => {
            const distance = ambulancePos.distanceTo(vehicle.mesh.position);
            const isAhead = this.isVehicleAhead(ambulancePos, vehicle.mesh.position);
            return distance <= this.detectionDistance && isAhead;
        });

        if (vehiclesAhead.length === 0) {
            this.clearBlocking();
            return;
        }

        // Categorize vehicles by lane
        const leftLane = [];
        const rightLane = [];
        
        vehiclesAhead.forEach(vehicle => {
            if (vehicle.laneOffset < 0) {
                leftLane.push(vehicle);
            } else {
                rightLane.push(vehicle);
            }
        });

        // Check if both lanes are blocked
        const bothLanesBlocked = leftLane.length > 0 && rightLane.length > 0;
        
        if (bothLanesBlocked && !this.isBlocked) {
            console.log('Both lanes blocked! Initiating emergency lane change...');
            this.isBlocked = true;
            this.blockingVehicles = [
                this.getClosestVehicle(leftLane, ambulancePos),
                this.getClosestVehicle(rightLane, ambulancePos)
            ].filter(v => v !== null);
            
            await this.initiateEmergencyLaneChange();
        } else if (!bothLanesBlocked && this.isBlocked) {
            this.clearBlocking();
        }
    }

    isVehicleAhead(ambulancePos, vehiclePos) {
        // Simple ahead detection - can be improved with road direction
        const direction = this.ambulance.velocity || new THREE.Vector3(0, 0, 1);
        const toVehicle = vehiclePos.clone().sub(ambulancePos).normalize();
        return direction.dot(toVehicle) > 0.3; // 30-degree cone ahead
    }

    getClosestVehicle(vehicles, ambulancePos) {
        if (vehicles.length === 0) return null;
        
        return vehicles.reduce((closest, vehicle) => {
            const distance = ambulancePos.distanceTo(vehicle.mesh.position);
            const closestDistance = ambulancePos.distanceTo(closest.mesh.position);
            return distance < closestDistance ? vehicle : closest;
        });
    }

    async initiateEmergencyLaneChange() {
        this.isDecisionPending = true;
        
        try {
            // Prepare data for backend
            const requestData = {
                num_lanes: 2,
                cars_data: this.blockingVehicles.map(vehicle => ({
                    placa: vehicle.driverData.placa,
                    dueño: vehicle.driverData['dueño'],
                    'nivel de conduccion': vehicle.driverData['nivel de conduccion'],
                    lane: vehicle.laneOffset < 0 ? 'left' : 'right'
                }))
            };

            console.log('Requesting lane change decision from backend...', requestData);

            // Get recommendation from backend
            const response = await fetch(this.backendUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error('Backend request failed');
            }

            const recommendation = await response.json();
            console.log('Backend recommendation:', recommendation);

            // Show UI with options
            this.showDecisionUI(recommendation);

        } catch (error) {
            console.error('Error getting lane change recommendation:', error);
            // Fallback to manual selection without recommendation
            this.showDecisionUI(null);
        }
    }

    showDecisionUI(recommendation = null) {
        const vehiclesContainer = document.getElementById('vehicles-container');
        const recommendationContainer = document.getElementById('recommendation-container');
        const buttonsContainer = document.getElementById('buttons-container');

        // Clear previous content
        vehiclesContainer.innerHTML = '';
        recommendationContainer.innerHTML = '';
        buttonsContainer.innerHTML = '';

        // Show blocking vehicles
        this.blockingVehicles.forEach((vehicle, index) => {
            const vehicleDiv = document.createElement('div');
            vehicleDiv.style.cssText = `
                background: rgba(255, 255, 255, 0.1);
                padding: 15px;
                border-radius: 5px;
                margin: 0 10px;
                cursor: pointer;
                transition: background 0.3s;
                border: 2px solid transparent;
            `;

            const drivingLevel = vehicle.driverData['nivel de conduccion'];
            const levelColor = this.getDrivingLevelColor(drivingLevel);

            vehicleDiv.innerHTML = `
                <h3>${vehicle.driverData['dueño']}</h3>
                <p>License: ${vehicle.driverData.placa}</p>
                <p style="color: ${levelColor}; font-weight: bold;">
                    Driving Level: ${drivingLevel}
                </p>
                <p>Lane: ${vehicle.laneOffset < 0 ? 'Left' : 'Right'}</p>
                <p>Vehicle: ${vehicle.type}</p>
            `;

            vehicleDiv.addEventListener('click', () => this.handleDriverSelection(vehicle));
            vehicleDiv.addEventListener('mouseenter', () => {
                vehicleDiv.style.background = 'rgba(255, 255, 255, 0.2)';
            });
            vehicleDiv.addEventListener('mouseleave', () => {
                vehicleDiv.style.background = 'rgba(255, 255, 255, 0.1)';
            });

            vehiclesContainer.appendChild(vehicleDiv);
        });

        // Show recommendation if available
        if (recommendation && recommendation.driver_chosen && recommendation.driver_chosen.length > 0) {
            const recommendedDriver = recommendation.driver_chosen[0];
            recommendationContainer.style.display = 'block';
            recommendationContainer.innerHTML = `
                <h3>🚨 AI Recommendation</h3>
                <p>Based on driving levels, <strong>${recommendedDriver.dueño}</strong> is the best choice.</p>
                <p style="color: ${this.getDrivingLevelColor(recommendedDriver['nivel de conduccion'])}">
                    Level: ${recommendedDriver['nivel de conduccion']} | License: ${recommendedDriver.placa}
                </p>
                <button id="accept-recommendation" style="
                    background: #00aa00;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                    margin: 10px;
                ">Accept Recommendation</button>
            `;

            document.getElementById('accept-recommendation').addEventListener('click', () => {
                this.handleRecommendedChoice(recommendedDriver);
            });
        }

        // Add manual selection buttons
        const manualDiv = document.createElement('div');
        manualDiv.innerHTML = `
            <p>Or choose manually:</p>
            <button id="cancel-action" style="
                background: #aa0000;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                margin: 10px;
            ">Cancel / Wait</button>
        `;
        buttonsContainer.appendChild(manualDiv);

        document.getElementById('cancel-action').addEventListener('click', () => {
            this.hideDecisionUI();
        });

        // Show the UI
        this.decisionUI.style.display = 'block';
        
        // Pause or slow down traffic during decision
        this.pauseTraffic();
    }

    handleDriverSelection(selectedVehicle) {
        console.log(`Player selected: ${selectedVehicle.driverData['dueño']}`);
        this.executeEmergencyLaneChange(selectedVehicle);
        this.hideDecisionUI();
    }

    handleRecommendedChoice(recommendedDriver) {
        // Find the vehicle corresponding to the recommended driver
        const selectedVehicle = this.blockingVehicles.find(vehicle => 
            vehicle.driverData.placa === recommendedDriver.placa
        );

        if (selectedVehicle) {
            console.log(`AI recommendation accepted: ${recommendedDriver.dueño}`);
            this.executeEmergencyLaneChange(selectedVehicle);
        } else {
            console.error('Recommended driver not found in blocking vehicles');
        }
        
        this.hideDecisionUI();
    }

    executeEmergencyLaneChange(vehicle) {
        console.log(`Executing emergency lane change for ${vehicle.driverData['dueño']}`);
        
        // Mark vehicle for emergency lane change
        vehicle.isEmergencyLaneChange = true;
        vehicle.emergencyLaneChangeProgress = 0;
        vehicle.originalLaneOffset = vehicle.laneOffset;
        vehicle.emergencyTargetOffset = vehicle.laneOffset < 0 ? -4.5 : 4.5; // Move to shoulder
        
        // Clear the blocking state
        this.clearBlocking();
        
        // Resume traffic
        this.resumeTraffic();
        
        // Set timer to return vehicle to traffic
        setTimeout(() => {
            this.returnVehicleToTraffic(vehicle);
        }, 8000); // 8 seconds to let ambulance pass
    }

    returnVehicleToTraffic(vehicle) {
        if (vehicle && vehicle.mesh && vehicle.mesh.parent) {
            console.log(`Returning ${vehicle.driverData['dueño']} to traffic`);
            vehicle.isReturningToTraffic = true;
            vehicle.emergencyLaneChangeProgress = 0;
            vehicle.isEmergencyLaneChange = false;
        }
    }

    hideDecisionUI() {
        this.decisionUI.style.display = 'none';
        this.isDecisionPending = false;
    }

    clearBlocking() {
        this.isBlocked = false;
        this.blockingVehicles = [];
        this.hideDecisionUI();
        this.resumeTraffic();
    }

    pauseTraffic() {
        // Slow down all traffic during decision making
        this.trafficManager.vehicles.forEach(vehicle => {
            vehicle.emergencySlowDown = true;
            vehicle.originalCurrentSpeed = vehicle.currentSpeed;
            vehicle.currentSpeed *= 0.3; // Slow to 30% speed
        });
    }

    resumeTraffic() {
        // Resume normal traffic speed
        this.trafficManager.vehicles.forEach(vehicle => {
            if (vehicle.emergencySlowDown) {
                vehicle.currentSpeed = vehicle.originalCurrentSpeed || vehicle.baseSpeed;
                vehicle.emergencySlowDown = false;
            }
        });
    }

    getDrivingLevelColor(level) {
        if (level >= 75) return '#00ff00'; // Green
        if (level >= 50) return '#ffff00'; // Yellow
        return '#ff0000'; // Red
    }

    update(deltaTime) {
        // Check for blocking every frame
        this.checkForBlocking();
        
        // Update emergency lane change animations
        this.updateEmergencyLaneChanges(deltaTime);
    }

    updateEmergencyLaneChanges(deltaTime) {
        this.trafficManager.vehicles.forEach(vehicle => {
            if (vehicle.isEmergencyLaneChange) {
                // Animate to shoulder
                vehicle.emergencyLaneChangeProgress += deltaTime * 0.8; // Speed of lane change
                
                if (vehicle.emergencyLaneChangeProgress >= 1) {
                    vehicle.emergencyLaneChangeProgress = 1;
                }
                
                const t = this.smoothStep(vehicle.emergencyLaneChangeProgress);
                vehicle.laneOffset = vehicle.originalLaneOffset + 
                    (vehicle.emergencyTargetOffset - vehicle.originalLaneOffset) * t;
                    
            } else if (vehicle.isReturningToTraffic) {
                // Animate back to lane
                vehicle.emergencyLaneChangeProgress += deltaTime * 0.6; // Slower return
                
                if (vehicle.emergencyLaneChangeProgress >= 1) {
                    vehicle.emergencyLaneChangeProgress = 1;
                    vehicle.isReturningToTraffic = false;
                    vehicle.laneOffset = vehicle.originalLaneOffset;
                }
                
                const t = this.smoothStep(vehicle.emergencyLaneChangeProgress);
                vehicle.laneOffset = vehicle.emergencyTargetOffset + 
                    (vehicle.originalLaneOffset - vehicle.emergencyTargetOffset) * t;
            }
        });
    }

    smoothStep(t) {
        return t * t * (3 - 2 * t);
    }

    // Debug method
    getStatus() {
        return {
            isBlocked: this.isBlocked,
            isDecisionPending: this.isDecisionPending,
            blockingVehicles: this.blockingVehicles.length,
            vehiclesInEmergencyLaneChange: this.trafficManager.vehicles.filter(v => v.isEmergencyLaneChange).length
        };
    }
}