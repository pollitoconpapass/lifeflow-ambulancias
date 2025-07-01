class DriverManager {
    constructor() {
        this.drivers = [];
        this.usedDrivers = new Set(); // Track drivers currently on road
        this.isLoaded = false;
    }

    async loadDriverData(filePath) {
        try {
            const response = await fetch('http://0.0.0.0:8082/whole-csv')
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            this.drivers = await response.json();
            this.isLoaded = true;

            console.log(`Loaded ${this.drivers.length} drivers from CSV`);
            return true;
        } catch (error) {
            console.error('Error loading driver data:', error);
            this.createFallbackData();
            return false;
        }
    }

    createFallbackData() {
        // Fallback data in case CSV loading fails
        this.drivers = [
            { placa: 'ABC123', clase: 'Sedan', marca: 'Toyota', modelo: '2020', 'dueño': 'Juan Pérez', 'nivel de conduccion': 85 },
            { placa: 'DEF456', clase: 'SUV', marca: 'Honda', modelo: '2019', 'dueño': 'María García', 'nivel de conduccion': 45 },
            { placa: 'GHI789', clase: 'Hatchback', marca: 'Nissan', modelo: '2021', 'dueño': 'Carlos López', 'nivel de conduccion': 60 },
        ];
        this.isLoaded = true;
        console.log('Using fallback driver data');
    }

    getRandomAvailableDriver() {
        if (!this.isLoaded || this.drivers.length === 0) {
            return this.createRandomDriver();
        }

        // Get drivers not currently in use
        const availableDrivers = this.drivers.filter(driver => 
            !this.usedDrivers.has(driver.placa)
        );

        if (availableDrivers.length === 0) {
            // If all drivers are in use, allow reuse (in a real scenario, this would be rare)
            return this.drivers[Math.floor(Math.random() * this.drivers.length)];
        }

        const selectedDriver = availableDrivers[Math.floor(Math.random() * availableDrivers.length)];
        this.usedDrivers.add(selectedDriver.placa);
        
        return { ...selectedDriver }; // Return a copy
    }

    releaseDriver(placa) {
        this.usedDrivers.delete(placa);
    }

    createRandomDriver() {
        // Fallback random driver generator
        const names = ['Ana Silva', 'Pedro Ruiz', 'Carmen Vega', 'José Torres', 'Laura Morales'];
        const brands = ['Toyota', 'Honda', 'Chevrolet', 'Hyundai', 'Nissan'];
        const models = ['2018', '2019', '2020', '2021', '2022', '2023'];
        
        return {
            placa: this.generateRandomPlate(),
            clase: 'Car',
            marca: brands[Math.floor(Math.random() * brands.length)],
            modelo: models[Math.floor(Math.random() * models.length)],
            'dueño': names[Math.floor(Math.random() * names.length)],
            'nivel de conduccion': Math.floor(Math.random() * 100)
        };
    }

    generateRandomPlate() {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const numbers = '0123456789';
        let plate = '';
        
        // Format: ABC123
        for (let i = 0; i < 3; i++) {
            plate += letters[Math.floor(Math.random() * letters.length)];
        }
        for (let i = 0; i < 3; i++) {
            plate += numbers[Math.floor(Math.random() * numbers.length)];
        }
        
        return plate;
    }

    getDrivingLevelColor(level) {
        if (level >= 75) return '#00ff00'; // Green
        if (level >= 50) return '#ffff00'; // Yellow
        return '#ff0000'; // Red
    }

    getDrivingLevelColorName(level) {
        if (level >= 75) return 'Excellent';
        if (level >= 50) return 'Average';
        return 'Poor';
    }
}