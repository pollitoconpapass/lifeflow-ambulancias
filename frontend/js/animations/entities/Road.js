class Road {
    constructor(scene) {
        this.scene = scene;
        this.roadGroup = new THREE.Group();
        this.scene.add(this.roadGroup);
    }

    generateRoad(waypoints) {
        // Clear existing road
        this.roadGroup.clear();
        
        for (let i = 0; i < waypoints.length - 1; i++) {
            const from = waypoints[i];
            const to = waypoints[i + 1];
            this.createRoadSegment({ from, to });
        }
    }

    createRoadSegment({ from, to }) {
        const distance = from.distanceTo(to);
        const roadGeometry = new THREE.PlaneGeometry(8, distance);
        const roadMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
        const roadSegment = new THREE.Mesh(roadGeometry, roadMaterial);
    
        const direction = new THREE.Vector3().subVectors(to, from).normalize();
        const midPoint = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
    
        roadSegment.position.copy(midPoint);
        roadSegment.rotation.x = -Math.PI / 2;
        roadSegment.rotation.z = Math.atan2(direction.x, direction.z);
        roadSegment.receiveShadow = true;
    
        this.roadGroup.add(roadSegment);
    
        // Add road markings
        this.createRoadMarkings({ from, to }, midPoint, direction, distance);
    }

    createRoadMarkings({ from, to }, midPoint, direction, distance) {
        const lineGeometry = new THREE.PlaneGeometry(0.2, distance);
        const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
        const centerLine = new THREE.Mesh(lineGeometry, lineMaterial);
        centerLine.position.copy(midPoint);
        centerLine.position.y = 0.01;
        centerLine.rotation.x = -Math.PI / 2;
        centerLine.rotation.z = Math.atan2(direction.x, direction.z);
        this.roadGroup.add(centerLine);
    }   
}