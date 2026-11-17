let loginDiv = document.getElementById('loginDiv')
let loginButton = document.getElementById('loginBtn');
let vehicleIdInput = document.getElementById('vehicleId');
let vehicleIdStatus = document.getElementById('status')
let recenterBtn = document.getElementById('recenter')

let serviceInfo = document.getElementById('serviceInfo')

serviceInfo.innerHTML = ""

recenterBtn.style.display = "none";

let wakeLock = null;
let keepScreenAwake = true;

let currentLine = null;
let currentPattern = null;

let patternCache = {}

const wsUri = "wss://horarioslx.onmtr.eu/vehicles/feed";
let webSocket = null;

startWebSocket()

let paused = false;

let lastKnownVehicleInfo = null;

let darkMode = false;
document.getElementById("themeToggle").onclick = () => {
    darkMode = !darkMode;
    //document.getElementById("themeToggle").innerHTML = darkMode ? "DIA" : "NOITE"
    document.getElementById("themeToggle").className = darkMode ? "dark" : "light"
    serviceInfo.className = darkMode ? "dark" : ""
    setTheme(darkMode)
}

document.getElementById("logout").onclick = () => {
    webSocket.send(JSON.stringify({ type: 'vehicleUnfocus', value: window.selectedVehicle}))
    window.selectedVehicle = null;
    currentPattern = null;
    currentLine = null;
    loginDiv.style.display = "flex";
}

snapToVehicle = () => {};

recenterBtn.onclick = () => {
    if(lastKnownVehicleInfo) snapToVehicle(lastKnownVehicleInfo)
}

let patternIdDestCache = {}

function startWebSocket() {
    webSocket = new WebSocket(wsUri);

    webSocket.addEventListener("open", () => {
        console.log("CONNECTED");
        if(window.selectedVehicle) webSocket.send(JSON.stringify({ type: 'vehicleFocus', value: {vehicleId: "[LA77N]" + window.selectedVehicle, radius: 3} }));
    });

    webSocket.addEventListener("message", (event) => {
        if(event.data === "ping") {
            if(window.selectedVehicle) {
                webSocket.send(JSON.stringify({ type: 'vehicleFocus', value: window.selectedVehicle}))
                loginDiv.style.display = "none";
            }
            return;
        };
        let res = JSON.parse(event.data)
        switch(res.type) {
            case "vehicleInfo":
                let vehicle = res.data;
                if(!vehicle && vehicleIdInput.value.trim() !== '') {
                    vehicleIdStatus.innerHTML = "Veículo não encontrado"
                    loginButton.disabled = true;
                } else if(vehicleIdInput.value.trim() === '') {
                    vehicleIdStatus.innerHTML = ""
                    loginButton.disabled = true;
                } else if(vehicle) {
                    loginButton.disabled = false;
                    let timestamp = vehicle.timestamp;
                    let timeDif = (Date.now() - timestamp) / 1000;
                    vehicle.line_id = vehicle.trip_id.split("]")[2].split("_")[0]
                    if(timeDif < 120) {
                        vehicleIdStatus.innerHTML = 'A circular na <span class="line long">' + (vehicle.line_id) + '</span>.'
                    } else vehicleIdStatus.innerHTML = 'Circulou na <span class="line long">' + (vehicle.line_id) + '</span> há ' + formatTimeSeconds(timeDif) + '.'
                }
                break;
            case "vehicleData":
                vehicleData = res.data.find(z => z.selected === true);
                if(!vehicleData) return;
                if(!lastKnownVehicleInfo || lastKnownVehicleInfo.id !== vehicleData.id) {
                    snapToVehicle(lastKnownVehicleInfo)
                    serviceInfo.innerHTML = `A carregar...`
                }
                lastKnownVehicleInfo = vehicleData;
                moveMapToLatLon(vehicleData)
                vehicleData.line_id = vehicleData.trip_id.split("]")[2].split("_")[0]
                vehicleData.pattern_id = vehicleData.trip_id.split("]").slice(1).join("]").split("_").slice(0, 3).join("_")
                if(currentLine !== vehicleData.line_id || currentPattern !== vehicleData.pattern_id) {
                    currentLine = vehicleData.line_id
                    currentPattern = vehicleData.pattern_id
                    if(!patternCache[vehicleData.pattern_id]) {
                        fetch("https://go.tmlmobilidade.pt/hub/api/v1/LA3SO/network/patterns/" + vehicleData.pattern_id).then(p => p.json()).then(p => {
                            patternIdDestCache[vehicleData.pattern_id] = p.data[0].headsign;
                            serviceInfo.innerHTML = `<span class="line long">${vehicleData.line_id}</span><span>${getDest(vehicleData.pattern_id)}`
                            
                            patternCache[vehicleData.pattern_id] = decodeShape(p.data[0].shape_polyline);
                            drawMainRoute(decodeShape(p.data[0].shape_polyline));
                        })
                    } else {
                        serviceInfo.innerHTML = `<span class="line long">${vehicleData.line_id}</span><span>${getDest(vehicleData.pattern_id)}`
                        drawMainRoute(patternCache[vehicleData.pattern_id])
                    }
                    
                }
                updateOtherCars(res.data.filter(z => z.selected !== true))
                break;
        }
        // A circular na <span class="line long">1622</span>.
    });

    webSocket.addEventListener("close", () => {
        console.log("DISCONNECTED");
        if(!paused) setTimeout(startWebSocket, 1000);
    });
}

function getDest(p) {
    return patternIdDestCache[p] || "[ERRO]"
}

loginButton.disabled = true;
vehicleIdInput.addEventListener('input', function() {
    if (vehicleIdInput.value.trim() === '') {
        loginButton.disabled = true;
    }

    webSocket.send(JSON.stringify({ type: 'vehicleQuery', value: "[LA77N]" + vehicleIdInput.value }));
})

loginButton.onclick = () => {
    window.selectedVehicle = vehicleIdInput.value;
    webSocket.send(JSON.stringify({ type: 'vehicleFocus', value: {vehicleId: "[LA77N]" + vehicleIdInput.value, radius: 3} }));
    loginDiv.style.display = "none";
}

function formatTimeSeconds(secs) {
    const minutes = Math.floor(secs / 60);

    if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        return `${hours} horas`;
    }

    return `${minutes} minutos`;
}

async function acquireWakeLock() {
    if (!keepScreenAwake)
        return;

    if (document.visibilityState !== "visible")
        return;

    if (!("wakeLock" in navigator)) {
        return;
    }

    try {
        wakeLock = await navigator.wakeLock.request("screen");

        wakeLock.addEventListener("release", () => {
            wakeLock = null;
        });
    } catch (err) {
        console.error("Failed to acquire wake lock:", err);
    }
}

async function releaseWakeLock() {
    if (wakeLock) {
        await wakeLock.release();
        wakeLock = null;
    }
}

acquireWakeLock();

document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible") {
        // App came back into focus
        await acquireWakeLock();
        //startWebSocket()
    } else {
        // App went into the background
        await releaseWakeLock();
        /*paused = true;
        webSocket.onclose = function () {}; // disable onclose handler first
        webSocket.close();*/
    }
});