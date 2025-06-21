class Buildings {
    static createBuildings(scene) {
        const buildingGeometry = new THREE.BoxGeometry(5, 12, 5);
        const buildingMaterials = [
            new THREE.MeshLambertMaterial({ color: 0x8B4513 }),
            new THREE.MeshLambertMaterial({ color: 0x696969 }),
            new THREE.MeshLambertMaterial({ color: 0xA0522D })
        ];
        
        for (let i = 0; i < 20; i++) {
            const building = new THREE.Mesh(buildingGeometry, buildingMaterials[i % 3]);
            building.position.x = (Math.random() - 0.5) * 200;
            building.position.z = (Math.random() - 0.5) * 200;
            building.position.y = 6;
            building.castShadow = true;
            building.receiveShadow = true;
            scene.add(building);
        }
    }
}
