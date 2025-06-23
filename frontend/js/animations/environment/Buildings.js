const ROAD_WIDTH = 8;
const BUILDING_HALF_SIZE = 2.5;
const SAFETY_MARGIN = 3.0; // Increased safety margin

// Helper function to get perpendicular vector that works reliably
function getPerpendicularVector(direction) {
    // Normalize the direction vector
    const normalizedDir = direction.clone().normalize();
    
    // For a road on the XZ plane, we want perpendicular in XZ plane
    // If direction is (x, 0, z), perpendicular is (-z, 0, x)
    return new THREE.Vector3(-normalizedDir.z, 0, normalizedDir.x).normalize();
}

// Helper function to check if a position is too close to the road
function isPositionOnRoad(position, routePoints, roadWidth = ROAD_WIDTH) {
    const points = routePoints.map(p => p instanceof THREE.Vector3 ? p : new THREE.Vector3(p.x, p.y, p.z));
    
    for (let i = 0; i < points.length - 1; i++) {
        const from = points[i];
        const to = points[i + 1];
        
        // Get the closest point on the road segment to our position
        const roadDirection = new THREE.Vector3().subVectors(to, from);
        const roadLength = roadDirection.length();
        roadDirection.normalize();
        
        const toPosition = new THREE.Vector3().subVectors(position, from);
        const projectionLength = toPosition.dot(roadDirection);
        
        // Check if the projection is within the segment
        if (projectionLength >= 0 && projectionLength <= roadLength) {
            const closestPointOnRoad = from.clone().add(roadDirection.clone().multiplyScalar(projectionLength));
            const distanceToRoad = position.distanceTo(closestPointOnRoad);
            
            // If too close to road, return true
            if (distanceToRoad < roadWidth / 2 + SAFETY_MARGIN) {
                return true;
            }
        }
    }
    return false;
}

class Buildings {
    static createBuildingsAlongRoute(scene, routePoints, options = {}) {
        const buildingGeometry = new THREE.BoxGeometry(5, 12, 5);
        const buildingMaterials = [
            new THREE.MeshLambertMaterial({ color: 0x8B4513 }),
            new THREE.MeshLambertMaterial({ color: 0x696969 }),
            new THREE.MeshLambertMaterial({ color: 0xA0522D })
        ];
        const numBuildingsPerSegment = options.numBuildingsPerSegment || 2;
        
        const points = routePoints.map(p => p instanceof THREE.Vector3 ? p : new THREE.Vector3(p.x, p.y, p.z));

        for (let i = 0; i < points.length - 1; i++) {
            const from = points[i];
            const to = points[i + 1];
            
            // Calculate direction and perpendicular vectors
            const segmentDir = new THREE.Vector3().subVectors(to, from);
            const perp = getPerpendicularVector(segmentDir);

            for (let side of [-1, 1]) { // Both sides of the road
                for (let b = 0; b < numBuildingsPerSegment; b++) {
                    let attempts = 0;
                    let buildingPos;
                    
                    // Try multiple times to find a valid position
                    do {
                        const t = 0.15 + Math.random() * 0.7; // Stay away from segment ends
                        const pointOnSegment = from.clone().lerp(to, t);

                        // Start farther from road
                        const minDistance = ROAD_WIDTH / 2 + BUILDING_HALF_SIZE + SAFETY_MARGIN + 5;
                        const maxDistance = minDistance + 25;
                        const distFromRoadCenter = minDistance + Math.random() * (maxDistance - minDistance);
                        
                        const offset = perp.clone().multiplyScalar(distFromRoadCenter * side);
                        buildingPos = pointOnSegment.clone().add(offset);
                        buildingPos.y = 6; // Half building height
                        
                        attempts++;
                    } while (isPositionOnRoad(buildingPos, routePoints) && attempts < 10);
                    
                    // Only place building if we found a valid position
                    if (!isPositionOnRoad(buildingPos, routePoints)) {
                        const building = new THREE.Mesh(buildingGeometry, buildingMaterials[Math.floor(Math.random() * buildingMaterials.length)]);
                        building.position.copy(buildingPos);
                        building.castShadow = true;
                        building.receiveShadow = true;
                        scene.add(building);
                    }
                }
            }
        }
    }
}

class Trees {
    static createTreesAlongRoute(scene, routePoints, options = {}) {
        const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.3, 2);
        const leavesGeometry = new THREE.SphereGeometry(1.2, 8, 6);
        const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8B5A2B });
        const leavesMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        const numTreesPerSegment = options.numTreesPerSegment || 3;
        
        const points = routePoints.map(p => p instanceof THREE.Vector3 ? p : new THREE.Vector3(p.x, p.y, p.z));
        
        for (let i = 0; i < points.length - 1; i++) {
            const from = points[i];
            const to = points[i + 1];
            
            const segmentDir = new THREE.Vector3().subVectors(to, from);
            const perp = getPerpendicularVector(segmentDir);

            for (let side of [-1, 1]) {
                for (let t = 0; t < numTreesPerSegment; t++) {
                    let attempts = 0;
                    let treePos;
                    
                    do {
                        const lerpT = 0.1 + Math.random() * 0.8;
                        const pointOnSegment = from.clone().lerp(to, lerpT);

                        // Trees can be closer to road than buildings
                        const minDistance = ROAD_WIDTH / 2 + 1.2 + SAFETY_MARGIN; // 1.2 is leaves radius
                        const maxDistance = minDistance + 15;
                        const distFromRoadCenter = minDistance + Math.random() * (maxDistance - minDistance);
                        
                        const offset = perp.clone().multiplyScalar(distFromRoadCenter * side);
                        treePos = pointOnSegment.clone().add(offset);
                        treePos.y = 1; // Trunk base
                        
                        attempts++;
                    } while (isPositionOnRoad(treePos, routePoints) && attempts < 10);

                    if (!isPositionOnRoad(treePos, routePoints)) {
                        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
                        trunk.position.copy(treePos);

                        const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
                        leaves.position.copy(treePos);
                        leaves.position.y += 1.5;

                        trunk.castShadow = leaves.castShadow = true;
                        scene.add(trunk);
                        scene.add(leaves);
                    }
                }
            }
        }
    }
}

class Houses {
    static createHousesAlongRoute(scene, routePoints, options = {}) {
        const houseMaterials = {
            wall: [
                new THREE.MeshLambertMaterial({ color: 0xD2B48C }),
                new THREE.MeshLambertMaterial({ color: 0xDEB887 }),
                new THREE.MeshLambertMaterial({ color: 0xF5DEB3 })
            ],
            roof: [
                new THREE.MeshLambertMaterial({ color: 0x8B0000 }),
                new THREE.MeshLambertMaterial({ color: 0x556B2F }),
                new THREE.MeshLambertMaterial({ color: 0x4682B4 })
            ],
            door: new THREE.MeshLambertMaterial({ color: 0x8B4513 }),
            window: new THREE.MeshBasicMaterial({ color: 0x87CEEB })
        };

        const numHousesPerSegment = options.numHousesPerSegment || 1;
        const points = routePoints.map(p => p instanceof THREE.Vector3 ? p : new THREE.Vector3(p.x, p.y, p.z));

        for (let i = 0; i < points.length - 1; i++) {
            const from = points[i];
            const to = points[i + 1];
            
            const segmentDir = new THREE.Vector3().subVectors(to, from);
            const perp = getPerpendicularVector(segmentDir);

            for (let side of [-1, 1]) {
                for (let h = 0; h < numHousesPerSegment; h++) {
                    if (Math.random() > 0.6) continue; // 40% chance to place a house

                    let attempts = 0;
                    let housePos;
                    
                    do {
                        const t = 0.2 + Math.random() * 0.6; // More conservative positioning
                        const pointOnSegment = from.clone().lerp(to, t);
                        
                        // Houses need more space
                        const minDistance = ROAD_WIDTH / 2 + 4 + SAFETY_MARGIN; // 4 is max house half-size
                        const maxDistance = minDistance + 20;
                        const distFromRoadCenter = minDistance + Math.random() * (maxDistance - minDistance);
                        
                        const offset = perp.clone().multiplyScalar(distFromRoadCenter * side);
                        housePos = pointOnSegment.clone().add(offset);
                        
                        attempts++;
                    } while (isPositionOnRoad(housePos, routePoints) && attempts < 10);
                    
                    if (!isPositionOnRoad(housePos, routePoints)) {
                        this.createHouse(scene, housePos, houseMaterials, segmentDir.normalize(), side);
                    }
                }
            }
        }
    }

    static createHouse(scene, position, materials, roadDirection, side) {
        const houseGroup = new THREE.Group();
        
        const width = 4 + Math.random() * 3;
        const depth = 5 + Math.random() * 4;
        const height = 3 + Math.random() * 2;
        
        // Create main house body
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const house = new THREE.Mesh(
            geometry,
            materials.wall[Math.floor(Math.random() * materials.wall.length)]
        );
        house.position.y = height / 2;
        house.castShadow = house.receiveShadow = true;
        houseGroup.add(house);

        // Add roof
        const roofHeight = 1 + Math.random() * 1.5;
        const roofGeometry = new THREE.ConeGeometry(width * 0.8, roofHeight, 4);
        const roof = new THREE.Mesh(
            roofGeometry,
            materials.roof[Math.floor(Math.random() * materials.roof.length)]
        );
        roof.position.y = height + (roofHeight / 2);
        roof.rotation.y = Math.PI / 4;
        houseGroup.add(roof);

        // Add door
        const door = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 1.5, 0.1),
            materials.door
        );
        door.position.set(0, 0.75, (depth / 2) + 0.05);
        houseGroup.add(door);

        // Add windows
        const windowGeometry = new THREE.PlaneGeometry(0.6, 0.6);
        const windowPositions = [
            { x: -width/2 + 0.6, y: 1.2, z: (depth/2) + 0.05 },
            { x: width/2 - 0.6, y: 1.2, z: (depth/2) + 0.05 },
            { x: -width/2 + 0.6, y: 1.2, z: -(depth/2) - 0.05, rotateY: Math.PI },
            { x: width/2 - 0.6, y: 1.2, z: -(depth/2) - 0.05, rotateY: Math.PI }
        ];

        windowPositions.forEach(pos => {
            const window = new THREE.Mesh(windowGeometry, materials.window);
            window.position.set(pos.x, pos.y, pos.z);
            if (pos.rotateY) window.rotation.y = pos.rotateY;
            houseGroup.add(window);
        });

        // Position and rotate the house group
        houseGroup.position.copy(position);
        houseGroup.rotation.y = Math.atan2(roadDirection.x, roadDirection.z) + (side > 0 ? 0 : Math.PI);
        
        // Add front yard
        if (Math.random() > 0.4) {
            const yardSize = depth * (0.8 + Math.random() * 0.4);
            const yardGeometry = new THREE.PlaneGeometry(width * 1.2, yardSize);
            const yard = new THREE.Mesh(
                yardGeometry,
                new THREE.MeshLambertMaterial({ 
                    color: 0x7CFC00,
                    side: THREE.DoubleSide
                })
            );
            yard.rotation.x = -Math.PI / 2;
            yard.position.set(0, 0.06, side * (depth/2 + yardSize/2));
            houseGroup.add(yard);
        }

        scene.add(houseGroup);
        return houseGroup;
    }
}

class Banners {
    static createBannersAlongRoute(scene, routePoints, options = {}) {
        const bannerGeometry = new THREE.PlaneGeometry(3, 2);
        const bannerMaterials = [
            new THREE.MeshBasicMaterial({ color: 0xFF0000, side: THREE.DoubleSide }),
            new THREE.MeshBasicMaterial({ color: 0x0000FF, side: THREE.DoubleSide }),
            new THREE.MeshBasicMaterial({ color: 0x008000, side: THREE.DoubleSide })
        ];

        const numBannersPerSegment = options.numBannersPerSegment || 1;
        const points = routePoints.map(p => p instanceof THREE.Vector3 ? p : new THREE.Vector3(p.x, p.y, p.z));

        for (let i = 0; i < points.length - 1; i++) {
            const from = points[i];
            const to = points[i + 1];
            
            const segmentDir = new THREE.Vector3().subVectors(to, from);
            const perp = getPerpendicularVector(segmentDir);

            const side = Math.random() > 0.5 ? 1 : -1;

            for (let b = 0; b < numBannersPerSegment; b++) {
                if (Math.random() > 0.7) continue; // 30% chance to place a banner

                let attempts = 0;
                let bannerPos;
                
                do {
                    const t = 0.2 + Math.random() * 0.6;
                    const pointOnSegment = from.clone().lerp(to, t);
                    
                    const distFromRoadCenter = ROAD_WIDTH / 2 + 1.5 + SAFETY_MARGIN; // 1.5 is banner half-width
                    const offset = perp.clone().multiplyScalar(distFromRoadCenter * side);
                    
                    bannerPos = pointOnSegment.clone().add(offset);
                    bannerPos.y = 2;
                    
                    attempts++;
                } while (isPositionOnRoad(bannerPos, routePoints) && attempts < 10);
                
                if (!isPositionOnRoad(bannerPos, routePoints)) {
                    const banner = new THREE.Mesh(
                        bannerGeometry,
                        bannerMaterials[Math.floor(Math.random() * bannerMaterials.length)]
                    );
                    
                    // Make banner face the road
                    banner.rotation.y = Math.atan2(segmentDir.normalize().x, segmentDir.normalize().z) + (side > 0 ? Math.PI/2 : -Math.PI/2);
                    banner.position.copy(bannerPos);
                    
                    // Add pole
                    const poleGeometry = new THREE.CylinderGeometry(0.1, 0.1, 3);
                    const pole = new THREE.Mesh(poleGeometry, new THREE.MeshLambertMaterial({ color: 0x8B4513 }));
                    pole.position.copy(bannerPos);
                    pole.position.y -= 1.5;
                    
                    scene.add(banner);
                    scene.add(pole);
                }
            }
        }
    }
}