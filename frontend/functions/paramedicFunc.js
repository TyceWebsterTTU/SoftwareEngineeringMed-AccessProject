let port;
let reader;
let isArmed = false;
let checkInterval;
// On page load, check if we already have permission for a port
// Define port at the top level so your polling function can see it later
let serialPort = null;

let usersTable = null;
let boxesTable = null;
let ambulanceTable = null;

class LineBreakTransformer {
    constructor() { this.container = ''; }
    transform(chunk, controller) {
        this.container += chunk;
        const lines = this.container.split('\n');
        this.container = lines.pop();
        lines.forEach(line => controller.enqueue(line));
    }
    flush(controller) { controller.enqueue(this.container); }
}



async function logout() {
    // Update logout timestamp
    await updateLogout();
    localStorage.clear();

    // 1. Redirect first
    window.location.href = "index.html";

    // 2. Clear fields ONLY if they exist (using the optional chaining we discussed)
    const userField = document.getElementById("txtUsrName");
    const passField = document.getElementById("txtPassword");

    if (userField) userField.value = '';
    if (passField) passField.value = '';
}

async function updateLogout() {
    const sessionID = localStorage.getItem('sessionID');
 
    if (!sessionID) {
        console.warn("No active session found");
        return;
    }
 
    try {
        const fetchRes = await fetch('/logout', {
            method: "PUT",
            headers: { "Content-Type": "application/json"},
            body: JSON.stringify({ sessionID: sessionID })
        })

        if (!fetchRes.ok) {
            console.error("Server rejected logout update:", fetchRes.status);
        }
 
    } catch (err) {
        console.error("Error:", err)
    }
}

// Function to start reading from the device
async function setupSerialReader() {
    try {
        const statusLabel = document.getElementById('serial-status');
        const terminal = document.getElementById('live-terminal');

        if (!serialPort.readable) return;

        // Update UI
        if (statusLabel) {
            statusLabel.innerText = "Connected";
            statusLabel.className = "badge bg-success fs-6";
        }
        if (terminal) {
            terminal.innerHTML += `<div class="text-info">> Hardware Linked. System ready for Dispatch.</div>`;
        }

        // Set up text decoding & line reading
        const textDecoder = new TextDecoderStream();
        serialPort.readable.pipeTo(textDecoder.writable);
        const inputStream = textDecoder.readable;

        reader = inputStream
            .pipeThrough(new TransformStream(new LineBreakTransformer()))
            .getReader();

        // Start listening to the ESP32
        listenToESP32();
    } catch (err) {
        console.error("Failed to set up serial reader:", err);
    }
}

window.addEventListener('load', async () => {
    const connectBtn = document.getElementById('connect-btn');
    const statusLabel = document.getElementById('serial-status');

    // --- STEP 1: Auto-connect ---
    try {
        const ports = await navigator.serial.getPorts();
        if (ports.length > 0) {
            console.log("Found an authorized port. Attempting auto-connect...");
            serialPort = ports[0];

            if (!serialPort.readable) {
                await serialPort.open({ baudRate: 115200 });
                console.log("Auto-connected to hardware!");
            }

            await setupSerialReader();
        }
    } catch (err) {
        console.warn("Auto-connect failed:", err);
    }

    // --- STEP 2: Manual connect via button ---
    if (connectBtn) {
        connectBtn.addEventListener('click', async () => {
            // Guard clause: already connected
            if (serialPort && serialPort.readable) {
                console.log("Port already open. No action needed.");
                return;
            }

            try {
                if (!serialPort) {
                    serialPort = await navigator.serial.requestPort();
                }

                await serialPort.open({ baudRate: 115200 });
                console.log("Connected manually via button click!");

                await setupSerialReader();
            } catch (err) {
                if (err.name === 'NotFoundError') {
                    console.log("Connection cancelled by user.");
                } else {
                    console.error("Manual connection failed:", err);
                    if (statusLabel) {
                        statusLabel.innerText = "Connection Failed";
                        statusLabel.className = "badge bg-danger fs-6";
                    }
                }
            }
        });
    }
});

/**
 * LISTEN FOR INCOMING DATA
 * Handles strings like "MATCH_FOUND" sent from the ESP32 hardware.
 */
async function listenToESP32() {
    const terminal = document.getElementById('live-terminal');
    
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
                const timestamp = new Date().toLocaleTimeString();
                terminal.innerHTML += `<div>[${timestamp}] ${value}</div>`;
                terminal.scrollTop = terminal.scrollHeight;

                // Handle the specific "Success" signal from your ESP32
                if (value.includes("MATCH_FOUND")) {
                    terminal.innerHTML += `<div class="text-success fw-bold">> ACCESS GRANTED: Phone Detected.</div>`;
                    isArmed = false; // Reset arming state
                    
                    // Log the success to your MySQL database
                    sendDataToServer("Access Granted: Box Opened via BLE");
                }
            }
        }
    } catch (err) {
        console.error("Read error:", err);
    }
}

/**
 * SEND "ARM" COMMAND TO ESP32 (OUTGOING)
 * This is called when your Dispatch Logic detects an active call.
 */
async function armNarcoticsBox(paramedicUUID) {
    const cleanUUID = paramedicUUID.trim(); // Keep original casing first
    if (!port || !port.writable) {
        console.error("ESP32 not connected.");
        return;
    }

    const writer = port.writable.getWriter();
    const encoder = new TextEncoder();
    
    // Explicitly add \n so ESP32's readStringUntil('\n') triggers
    const data = encoder.encode("ARM:" + cleanUUID + "\n");
    
    try {
        await writer.write(data);
        console.log("SENT TO ESP32: ARM:" + cleanUUID);
    } catch (err) {
        console.error("Write error:", err);
    } finally {
        writer.releaseLock();
    }
}

/**
 * LOG DATA TO MYSQL
 * Forwards hardware events to your Proxmox backend.
 */
async function sendDataToServer(dataString) {
    try {
        // Grab current userID from session (ensure you set this during login!)
        const userID = localStorage.getItem('userID') || 0;

        await fetch('/api/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                data: dataString,
                userID: userID
            })
        });
    } catch (err) {
        console.error("Database logging failed:", err);
    }
}


// This runs every 5 seconds to check for new dispatch calls
function startDispatchPolling() {
    setInterval(async () => {
        const ambulanceID = localStorage.getItem('ambulanceID');

        if (!ambulanceID || ambulanceID === "undefined") {
        console.error("No Ambulance ID found. Polling cannot start.");
        return;
    }
        try {
            // Ask the backend for the current status of this ambulance
            const response = await fetch(`/api/dispatch/status/${ambulanceID}`);

            if (!response.ok) {
                console.error(`Backend returned ${response.status} for ID: ${ambulanceID}`);
                return;
            }

            const status = await response.json();

            // Logic: If a call is active and we haven't armed the box yet
            if (status.ActiveCall > 0 && !isArmed) {
                
                
                console.log("Found UUID:", status.serviceUUID);
                armNarcoticsBox(status.serviceUUID);
            } 
            
            // Optional: If the call is cleared (ActiveCall returns to 0)
            else if (status.ActiveCall === 0 && isArmed) {
                isArmed = false;
                console.log("Call Cleared. Box Standby.");
            }
        } catch (err) {
            console.error("Polling error:", err);
        }
    }, 5000); 
}



// Call this when the dashboard loads
//if (window.location.pathname.includes("ambulance.html")) {
//    startStatusCheck();
//}

async function triggerDispatch() {
    const unitID = document.getElementById('dispatchUnitID').value;
    const caseID = document.getElementById('dispatchCaseID').value;

    if (!unitID || !caseID) {
        alert("Please enter both a Unit ID and a Case ID.");
        return;
    }

    try {
        const response = await fetch("/api/dispatch/trigger", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ unitID, caseID })
        });

        const data = await response.json();
        if (data.success) {
            alert(`Unit ${unitID} has been dispatched to Case ${caseID}`);
        }
    } catch (err) {
        console.error("Dispatch Error:", err);
    }
}