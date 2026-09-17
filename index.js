let loginButton = document.getElementById('loginBtn');
let vehicleIdInput = document.getElementById('vehicleId');
let vehicleIdStatus = document.getElementById('status')

let wakeLock = null;
let keepScreenAwake = true;

const wsUri = "ws://192.168.1.132:3001";
let webSocket = null;

startWebSocket()

let paused = false;

function startWebSocket() {
    webSocket = new WebSocket(wsUri);

    webSocket.addEventListener("open", () => {
        console.log("CONNECTED");
    
    });

    webSocket.addEventListener("message", (event) => {
        if(event.data === "ping") return;
        let data = JSON.parse(event.data)
        switch(data.type) {
            case "vehicleValidation":
                let vehicle = data.value;
                console.log(vehicle)
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
        alert("wake lock not in navigator")
        return;
    }

    try {
        wakeLock = await navigator.wakeLock.request("screen");

        wakeLock.addEventListener("release", () => {
            console.log("Wake lock released");
            wakeLock = null;
            alert("wake lock released")
        });

        console.log("Wake lock acquired");
        alert("wake lock acquired")
    } catch (err) {
        console.error("Failed to acquire wake lock:", err);
    }
}

async function releaseWakeLock() {
    if (wakeLock) {
        await wakeLock.release();
        alert("wake lock released")
        wakeLock = null;
    }
}

acquireWakeLock();

document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible") {
        // App came back into focus
        await acquireWakeLock();
        startWebSocket()
    } else {
        // App went into the background
        await releaseWakeLock();
        paused = true;
        webSocket.onclose = function () {}; // disable onclose handler first
        webSocket.close();
    }
});