const ROAD_WIDTH = 8;
const BUILDING_HALF_SIZE = 2.5; // (if building width is 5)
const SAFETY_MARGIN = 8.0;      // Extra gap for visual safety

class Buildings {
    static createBuildingsAlongRoute(scene, routePoints, options = {}) {
        const buildingGeometry = new THREE.BoxGeometry(5, 12, 5);
        const buildingMaterials = [
            new THREE.MeshLambertMaterial({ color: 0x8B4513 }),
            new THREE.MeshLambertMaterial({ color: 0x696969 }),
            new THREE.MeshLambertMaterial({ color: 0xA0522D })
        ];
        const numBuildingsPerSegment = options.numBuildingsPerSegment || 2;
        
        // Ajustar las distancias para que los edificios estén fuera de la carretera
        const roadHalfWidth = ROAD_WIDTH / 2;
        // const minDistanceFromRoad = roadHalfWidth + BUILDING_HALF_SIZE + SAFETY_MARGIN;
        // const maxDistanceFromRoad = minDistanceFromRoad + 30;

        // Convert route points to THREE.Vector3 if they aren't already
        const points = routePoints.map(p => p instanceof THREE.Vector3 ? p : new THREE.Vector3(p.x, p.y, p.z));

        for (let i = 0; i < points.length - 1; i++) {
            const from = points[i];
            const to = points[i + 1];
            const segmentDir = new THREE.Vector3().subVectors(to, from).normalize();
            
            // Calcular el vector perpendicular normalizado
            const perp = new THREE.Vector3(-segmentDir.z, 0, segmentDir.x).normalize();

            for (let side of [-1, 1]) { // Lados de la carretera
                for (let b = 0; b < numBuildingsPerSegment; b++) {
                    // Usar un valor aleatorio para la posición a lo largo del segmento
                    const t = 0.1 + Math.random() * 0.8; // Evitar los extremos del segmento
                    const pointOnSegment = from.clone().lerp(to, t);

                    // Calcular la distancia desde el borde de la carretera
                    const distFromRoadEdge = BUILDING_HALF_SIZE + SAFETY_MARGIN + (Math.random() * 20);
                    
                    // Calcular la posición final del edificio
                    const offset = perp.clone().multiplyScalar(roadHalfWidth + distFromRoadEdge);
                    const buildingPos = pointOnSegment.clone().add(offset.multiplyScalar(side));
                    buildingPos.y = 6; // altura media del edificio

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

class Trees {
    static createTreesAlongRoute(scene, routePoints, options = {}) {
        const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.3, 2);
        const leavesGeometry = new THREE.SphereGeometry(1.2, 8, 6);
        const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8B5A2B });
        const leavesMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        const numTreesPerSegment = options.numTreesPerSegment || 2;
        const minDistanceFromRoad = (ROAD_WIDTH / 2) + 2 + SAFETY_MARGIN; 
        const maxDistanceFromRoad = minDistanceFromRoad + 12;

        // Convert route points to THREE.Vector3 if they aren't already
        const points = routePoints.map(p => p instanceof THREE.Vector3 ? p : new THREE.Vector3(p.x, p.y, p.z));
        
        for (let i = 0; i < points.length - 1; i++) {
            const from = points[i];
            const to = points[i + 1];
            const segmentDir = new THREE.Vector3().subVectors(to, from).normalize();
            const perp = new THREE.Vector3(-segmentDir.z, 0, segmentDir.x);

            for (let side of [-1, 1]) {
                for (let t = 0; t < numTreesPerSegment; t++) {
                    const lerpT = Math.random();
                    const pointOnSegment = from.clone().lerp(to, lerpT);

                    const distFromRoad = minDistanceFromRoad + Math.random() * (maxDistanceFromRoad - minDistanceFromRoad);
                    const offset = perp.clone().multiplyScalar(distFromRoad * side);

                    const treeBase = pointOnSegment.clone().add(offset);
                    treeBase.y = 1; // Trunk base

                    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
                    trunk.position.copy(treeBase);

                    const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
                    leaves.position.copy(treeBase);
                    leaves.position.y += 1.5;

                    trunk.castShadow = leaves.castShadow = true;
                    scene.add(trunk);
                    scene.add(leaves);
                }
            }
        }
    }
}

class Houses {
    static createHousesAlongRoute(scene, routePoints, options = {}) {
        const houseMaterials = {
            wall: [
                new THREE.MeshLambertMaterial({ color: 0xD2B48C }), // tan
                new THREE.MeshLambertMaterial({ color: 0xDEB887 }), // burlywood
                new THREE.MeshLambertMaterial({ color: 0xF5DEB3 })  // wheat
            ],
            roof: [
                new THREE.MeshLambertMaterial({ color: 0x8B0000 }), // dark red
                new THREE.MeshLambertMaterial({ color: 0x556B2F }), // dark olive green
                new THREE.MeshLambertMaterial({ color: 0x4682B4 })  // steel blue
            ],
            door: new THREE.MeshLambertMaterial({ color: 0x8B4513 }), // saddle brown
            window: new THREE.MeshBasicMaterial({ color: 0x87CEEB })  // sky blue
        };

        const numHousesPerSegment = options.numHousesPerSegment || 1;
        const minDistanceFromRoad = (ROAD_WIDTH / 2) + 4 + SAFETY_MARGIN;
        const maxDistanceFromRoad = minDistanceFromRoad + 20;

        const points = routePoints.map(p => p instanceof THREE.Vector3 ? p : new THREE.Vector3(p.x, p.y, p.z));

        for (let i = 0; i < points.length - 1; i++) {
            const from = points[i];
            const to = points[i + 1];
            const segmentDir = new THREE.Vector3().subVectors(to, from).normalize();
            const perp = new THREE.Vector3(-segmentDir.z, 0, segmentDir.x);

            for (let side of [-1, 1]) {
                for (let h = 0; h < numHousesPerSegment; h++) {
                    if (Math.random() > 0.7) continue; // 30% chance to skip placing a house here

                    const t = Math.random();
                    const pointOnSegment = from.clone().lerp(to, t);
                    const distFromRoad = minDistanceFromRoad + Math.random() * (maxDistanceFromRoad - minDistanceFromRoad);
                    const offset = perp.clone().multiplyScalar(distFromRoad * side);
                    const housePos = pointOnSegment.clone().add(offset);
                    
                    this.createHouse(scene, housePos, houseMaterials, perp, side);
                }
            }
        }
    }

    static createHouse(scene, position, materials, roadDirection, side) {
        const houseGroup = new THREE.Group();
        const houseType = Math.floor(Math.random() * 3); // 0: basic, 1: L-shaped, 2: with porch
        
        // Random house dimensions
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
        const roofGeometry = new THREE.ConeGeometry(
            width * 0.8, 
            roofHeight, 
            4
        );
        const roof = new THREE.Mesh(
            roofGeometry,
            materials.roof[Math.floor(Math.random() * materials.roof.length)]
        );
        roof.position.y = height + (roofHeight / 2);
        roof.rotation.y = Math.PI / 4; // Rotate 45 degrees to make it a square roof
        houseGroup.add(roof);

        // Add door
        const door = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 1.5, 0.1),
            materials.door
        );
        door.position.set(
            0,
            0.75,
            (depth / 2) + 0.05
        );
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
        
        // Add a small front yard
        if (Math.random() > 0.3) { // 70% chance to add a front yard
            const yardSize = depth * (0.8 + Math.random() * 0.5);
            const yardGeometry = new THREE.PlaneGeometry(width * 1.2, yardSize);
            const yard = new THREE.Mesh(
                yardGeometry,
                new THREE.MeshLambertMaterial({ 
                    color: 0x7CFC00, // lawn green
                    side: THREE.DoubleSide
                })
            );
            yard.rotation.x = -Math.PI / 2;
            yard.position.y = 0.06;
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
            new THREE.MeshBasicMaterial({ 
                color: 0xFF0000,
                side: THREE.DoubleSide
            }),
            new THREE.MeshBasicMaterial({ 
                color: 0x0000FF,
                side: THREE.DoubleSide
            }),
            new THREE.MeshBasicMaterial({ 
                color: 0x008000,
                side: THREE.DoubleSide
            })
        ];

        const numBannersPerSegment = options.numBannersPerSegment || 1;
        const distanceFromRoad = (ROAD_WIDTH / 2) + 1;

        const points = routePoints.map(p => p instanceof THREE.Vector3 ? p : new THREE.Vector3(p.x, p.y, p.z));

        for (let i = 0; i < points.length - 1; i++) {
            const from = points[i];
            const to = points[i + 1];
            const segmentDir = new THREE.Vector3().subVectors(to, from).normalize();
            const perp = new THREE.Vector3(-segmentDir.z, 0, segmentDir.x);

            // Only place banners on one side of the road
            const side = Math.random() > 0.5 ? 1 : -1;

            for (let b = 0; b < numBannersPerSegment; b++) {
                if (Math.random() > 0.8) continue; // 20% chance to skip placing a banner here

                const t = Math.random();
                const pointOnSegment = from.clone().lerp(to, t);
                const offset = perp.clone().multiplyScalar(distanceFromRoad * side);
                
                const bannerPos = pointOnSegment.clone().add(offset);
                bannerPos.y = 2; // Height of the banner

                const banner = new THREE.Mesh(
                    bannerGeometry,
                    bannerMaterials[Math.floor(Math.random() * bannerMaterials.length)]
                );
                
                // Make the banner face the road
                banner.rotation.y = Math.atan2(perp.x, perp.z) + (side > 0 ? 0 : Math.PI);
                banner.position.copy(bannerPos);
                
                // Add a pole
                const poleGeometry = new THREE.CylinderGeometry(0.1, 0.1, 3);
                const pole = new THREE.Mesh(
                    poleGeometry,
                    new THREE.MeshLambertMaterial({ color: 0x8B4513 }) // brown
                );
                pole.position.copy(bannerPos);
                pole.position.y -= 1.5; // Half the height of the pole
                
                // Add to scene
                scene.add(banner);
                scene.add(pole);
            }
        }
    }
}