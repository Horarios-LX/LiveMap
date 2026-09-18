let loginDiv = document.getElementById('loginDiv')
let loginButton = document.getElementById('loginBtn');
let vehicleIdInput = document.getElementById('vehicleId');
let vehicleIdStatus = document.getElementById('status')

let wakeLock = null;
let keepScreenAwake = true;

let currentLine = null;

let patternCache = {}

const wsUri = "wss://ws.doesmtr.eu/";
let webSocket = null;

startWebSocket()

let paused = false;

let darkMode = false;
document.getElementById("themeToggle").onclick = () => {
    darkMode = !darkMode;
    document.getElementById("themeToggle").innerHTML = darkMode ? "DIA" : "NOITE"
    document.getElementById("themeToggle").className = darkMode ? "dark" : "light"

    setTheme(darkMode)
}

document.getElementById("logout").onclick = () => {
    webSocket.send(JSON.stringify({ type: 'vehicleUnfocus', value: window.selectedVehicle}))
    window.selectedVehicle = null;
            loginDiv.style.display = "flex";
}

function startWebSocket() {
    webSocket = new WebSocket(wsUri);

    webSocket.addEventListener("open", () => {
        console.log("CONNECTED");
        if(window.selectedVehicle) {
            webSocket.send(JSON.stringify({ type: 'vehicleFocus', value: window.selectedVehicle}))
            loginDiv.style.display = "none";
        }
    });

    webSocket.addEventListener("message", (event) => {
        if(event.data === "ping") return;
        let data = JSON.parse(event.data)
        switch(data.type) {
            case "vehicleValidation":
                let vehicle = data.value;
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
                    if(timeDif < 120) {
                        vehicleIdStatus.innerHTML = 'A circular na <span class="line long">' + (vehicle.line_id) + '</span>.'
                    } else vehicleIdStatus.innerHTML = 'Circulou na <span class="line long">' + (vehicle.line_id) + '</span> há ' + formatTimeSeconds(timeDif) + '.'
                }
                break;
            case "vehicleUpdate":
                moveMapToLatLon(data.value)
                if(currentLine !== data.value.line_id) {
                    currentLine = data.value.line_id
                    if(!patternCache[data.value.pattern_id]) {
                        fetch("https://go.tmlmobilidade.pt/hub/api/v1/network/patterns/%5BLA77N%5D" + data.value.pattern_id.split("]")[2]).then(p => p.json()).then(p => {
                            patternCache[data.value.pattern_id] = decodeShape(p.data[0].shape_polyline);
                            drawMainRoute(decodeShape(p.data[0].shape_polyline));
                        })
                    } else {
                        drawMainRoute(patternCache[data.value.pattern_id])
                    }
                    
                }
                break;
            case "vehicleNeighbours":
                updateOtherCars(data.value)
        }
        // A circular na <span class="line long">1622</span>.
    });

    webSocket.addEventListener("close", () => {
        console.log("DISCONNECTED");
        if(!paused) setTimeout(startWebSocket, 1000);
    });
}

loginButton.disabled = true;
vehicleIdInput.addEventListener('input', function() {
    if (vehicleIdInput.value.trim() === '') {
        loginButton.disabled = true;
    }

    webSocket.send(JSON.stringify({ type: 'vehicleIdInput', value: vehicleIdInput.value }));
})

loginButton.onclick = () => {
    window.selectedVehicle = vehicleIdInput.value;
    webSocket.send(JSON.stringify({ type: 'vehicleFocus', value: vehicleIdInput.value}))
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