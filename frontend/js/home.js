function goToMapPage() {
    const startLocation = document.getElementById('startLocation').value;
    const endLocation = document.getElementById('endLocation').value;

    if (!startLocation || !endLocation) {
        alert("Por favor, llena ambos campos.");
        return;
    }

    // Store values in localStorage for use in the next page
    localStorage.setItem('startLocation', startLocation);
    localStorage.setItem('endLocation', endLocation);

    // Redirect to the Leaflet map page
    window.location.href = "osm_mapping.html";
}