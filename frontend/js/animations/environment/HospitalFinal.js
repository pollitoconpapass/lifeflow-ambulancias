class Hospital {
    static createHospital(scene, position) {
        const hospitalGroup = new THREE.Group();
        
        // Main building - more realistic proportions
        const buildingGeometry = new THREE.BoxGeometry(12, 15, 8);
        const buildingMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xF5F5F5, // Clean white/light gray
            transparent: true,
            opacity: 0.95
        });
        const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
        building.position.y = 7.5; // Half of height to sit on ground
        building.castShadow = true;
        building.receiveShadow = true;
        hospitalGroup.add(building);

        // Flat roof with slight overhang
        const roofGeometry = new THREE.BoxGeometry(12.5, 0.5, 8.5);
        const roofMaterial = new THREE.MeshLambertMaterial({ color: 0x404040 });
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.position.y = 15.25;
        roof.castShadow = true;
        hospitalGroup.add(roof);

        // Entrance canopy
        const canopyGeometry = new THREE.BoxGeometry(4, 0.2, 2);
        const canopyMaterial = new THREE.MeshLambertMaterial({ color: 0x2E86C1 });
        const canopy = new THREE.Mesh(canopyGeometry, canopyMaterial);
        canopy.position.set(0, 3, 4.2);
        canopy.castShadow = true;
        hospitalGroup.add(canopy);

        // Canopy supports
        const supportGeometry = new THREE.CylinderGeometry(0.1, 0.1, 2.5);
        const supportMaterial = new THREE.MeshLambertMaterial({ color: 0x2E86C1 });
        
        for (let i = -1; i <= 1; i += 2) {
            const support = new THREE.Mesh(supportGeometry, supportMaterial);
            support.position.set(i * 1.5, 1.75, 4.2);
            support.castShadow = true;
            hospitalGroup.add(support);
        }

        // Windows - more realistic layout
        const windowGeometry = new THREE.BoxGeometry(0.8, 1.2, 0.05);
        const windowMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x87CEEB,
            transparent: true,
            opacity: 0.7
        });

        // Front face windows
        for (let floor = 0; floor < 4; floor++) {
            for (let i = -2; i <= 2; i++) {
                if (floor === 0 && Math.abs(i) <= 1) continue; // Skip entrance area
                
                const window = new THREE.Mesh(windowGeometry, windowMaterial);
                window.position.set(i * 2.2, 3 + floor * 3, 4.05);
                hospitalGroup.add(window);
            }
        }

        // Side face windows (left and right)
        for (let side = -1; side <= 1; side += 2) {
            for (let floor = 0; floor < 4; floor++) {
                for (let i = -1; i <= 1; i++) {
                    const window = new THREE.Mesh(windowGeometry, windowMaterial);
                    window.position.set(side * 6.05, 3 + floor * 3, i * 2.5);
                    window.rotation.y = Math.PI / 2;
                    hospitalGroup.add(window);
                }
            }
        }

        // Main entrance door
        const doorGeometry = new THREE.BoxGeometry(2, 2.5, 0.1);
        const doorMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x2E86C1,
            transparent: true,
            opacity: 0.8
        });
        const door = new THREE.Mesh(doorGeometry, doorMaterial);
        door.position.set(0, 1.25, 4.05);
        hospitalGroup.add(door);

        // Hospital cross symbol
        const crossVertical = new THREE.BoxGeometry(0.3, 2, 0.1);
        const crossHorizontal = new THREE.BoxGeometry(1.5, 0.4, 0.1);
        const crossMaterial = new THREE.MeshLambertMaterial({ color: 0xFF0000 });
        
        const crossV = new THREE.Mesh(crossVertical, crossMaterial);
        const crossH = new THREE.Mesh(crossHorizontal, crossMaterial);
        
        crossV.position.set(-4, 12, 4.05);
        crossH.position.set(-4, 12, 4.05);
        
        hospitalGroup.add(crossV);
        hospitalGroup.add(crossH);

        // Emergency entrance (side)
        const emergencySignGeometry = new THREE.BoxGeometry(1.5, 0.5, 0.1);
        const emergencySignMaterial = new THREE.MeshLambertMaterial({ color: 0xFF4500 });
        const emergencySign = new THREE.Mesh(emergencySignGeometry, emergencySignMaterial);
        emergencySign.position.set(6.05, 8, 0);
        emergencySign.rotation.y = Math.PI / 2;
        hospitalGroup.add(emergencySign);

        // Helipad on roof
        const helipadGeometry = new THREE.CylinderGeometry(2, 2, 0.1);
        const helipadMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        const helipad = new THREE.Mesh(helipadGeometry, helipadMaterial);
        helipad.position.set(3, 15.5, -2);
        hospitalGroup.add(helipad);

        // Helipad 'H' marking
        const hMarkingGeometry = new THREE.BoxGeometry(0.8, 0.2, 0.05);
        const hMarkingMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
        
        const hVertical1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.05), hMarkingMaterial);
        const hVertical2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.05), hMarkingMaterial);
        const hHorizontal = new THREE.Mesh(hMarkingGeometry, hMarkingMaterial);
        
        hVertical1.position.set(2.7, 15.55, -2);
        hVertical2.position.set(3.3, 15.55, -2);
        hHorizontal.position.set(3, 15.55, -2);
        
        hospitalGroup.add(hVertical1);
        hospitalGroup.add(hVertical2);
        hospitalGroup.add(hHorizontal);

        // Air conditioning units on roof
        for (let i = 0; i < 3; i++) {
            const acGeometry = new THREE.BoxGeometry(1, 0.5, 0.8);
            const acMaterial = new THREE.MeshLambertMaterial({ color: 0x708090 });
            const ac = new THREE.Mesh(acGeometry, acMaterial);
            ac.position.set(-3 + i * 2, 15.75, 2);
            ac.castShadow = true;
            hospitalGroup.add(ac);
        }

        // Satellite dish
        const dishGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.1);
        const dishMaterial = new THREE.MeshLambertMaterial({ color: 0xC0C0C0 });
        const dish = new THREE.Mesh(dishGeometry, dishMaterial);
        dish.position.set(-4, 16, -2);
        dish.rotation.x = Math.PI / 6;
        hospitalGroup.add(dish);

        // Parking lot lines (simple rectangles on ground)
        const parkingLineGeometry = new THREE.BoxGeometry(0.1, 0.01, 5);
        const parkingLineMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
        
        for (let i = -3; i <= 3; i++) {
            const line = new THREE.Mesh(parkingLineGeometry, parkingLineMaterial);
            line.position.set(i * 2.5, 0.01, -8);
            hospitalGroup.add(line);
        }

        // Ambulance bay canopy
        const bayCanopyGeometry = new THREE.BoxGeometry(6, 0.3, 3);
        const bayCanopyMaterial = new THREE.MeshLambertMaterial({ color: 0xFF6347 });
        const bayCanopy = new THREE.Mesh(bayCanopyGeometry, bayCanopyMaterial);
        bayCanopy.position.set(8, 4, 0);
        bayCanopy.castShadow = true;
        hospitalGroup.add(bayCanopy);

        // Bay canopy supports
        for (let i = -1; i <= 1; i += 2) {
            for (let j = -1; j <= 1; j += 2) {
                const baySupport = new THREE.Mesh(supportGeometry, new THREE.MeshLambertMaterial({ color: 0xFF6347 }));
                baySupport.position.set(8 + i * 2.5, 2.75, j * 1.2);
                baySupport.castShadow = true;
                hospitalGroup.add(baySupport);
            }
        }

        // Add some exterior lighting
        const lightGeometry = new THREE.SphereGeometry(0.1);
        const lightMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xFFFACD,
            emissive: 0x444400
        });
        
        for (let i = -1; i <= 1; i += 2) {
            const light = new THREE.Mesh(lightGeometry, lightMaterial);
            light.position.set(i * 3, 3.5, 4.2);
            hospitalGroup.add(light);
        }

        // Position the entire hospital group
        hospitalGroup.position.copy(position);
        scene.add(hospitalGroup);
        
        return hospitalGroup; // Return the group for further manipulation if needed
    }
}