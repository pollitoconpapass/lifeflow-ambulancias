class GameScene {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = null;
        this.renderer = null;
        this.init();
    }

    init() {
        // Scene setup
        this.scene.background = new THREE.Color(0x87CEEB);
        
        // Camera setup
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.getElementById('gameContainer').appendChild(this.renderer.domElement);
        
        // Setup lighting
        Lighting.setupLighting(this.scene);
        
        // Add buildings
        Buildings.createBuildings(this.scene);
        
        // Handle window resize
        this.setupWindowResize();
    }

    setupWindowResize() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    updateCamera(vehicle) {
        const carPosition = vehicle.mesh.position.clone();
        const carForward = new THREE.Vector3(0, 0, -1);
        carForward.applyQuaternion(vehicle.mesh.quaternion);
        
        const cameraOffset = carForward.clone().multiplyScalar(-15);
        cameraOffset.y = 8;
        
        this.camera.position.copy(carPosition.clone().add(cameraOffset));
        this.camera.lookAt(carPosition);
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}

