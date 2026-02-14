let port = null;
let reader = null;
let hasSentArmCommand = false;

// On page load, check if we already have permission for a port
// Define port at the top level so your polling function can see it later


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

        if (!port.readable) return;

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
        port.readable.pipeTo(textDecoder.writable);
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
            port = ports[0];

            if (!port.readable) {
                await port.open({ baudRate: 115200 });
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
            if (port && port.readable) {
                console.log("Port already open. No action needed.");
                return;
            }

            try {
                if (!port) {
                    port = await navigator.serial.requestPort();
                }

                await port.open({ baudRate: 115200 });
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

                if (value.includes("MATCH_FOUND")) {
                    terminal.innerHTML += `<div class="text-success fw-bold">> ACCESS GRANTED: Phone Detected.</div>`;
                    
                    // We DO NOT set hasSentArmCommand to false here.
                    // We DO NOT set Needed to 0 here.
                    // This keeps the system in an "Armed" state as long as the call is active.

                    sendDataToServer("Access Event: Box opened by authorized phone.");
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
    // 1. Safety Check: If UUID is null/undefined, stop immediately
    if (!paramedicUUID) {
        console.error("Cannot arm: paramedicUUID is null or undefined.");
        return;
    }

    // 2. Now it is safe to trim because we know it's a string
    const cleanUUID = paramedicUUID.trim(); 
    console.log("Current Port State:", port);
    if (port) {
        console.log("Is Port Writable?:", port.writable);
    }

    if (!port || !port.writable) {
        console.error("ESP32 not connected.");
        return;
    }

    const writer = port.writable.getWriter();
    const encoder = new TextEncoder();
    
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

async function disarmNarcoticsBox() {
    if (!port || !port.writable) {
        console.error("Cannot disarm: ESP32 not connected.");
        return;
    }

    const writer = port.writable.getWriter();
    const encoder = new TextEncoder();
    
    // We send a specific DISARM command. 
    // The \n is critical so the ESP32 knows the message is over.
    const data = encoder.encode("DISARM\n");
    
    try {
        await writer.write(data);
        console.log("SENT TO ESP32: DISARM");
        hasSentArmCommand = false; // Reset our local tracker
    } catch (err) {
        console.error("Serial Write Error (Disarm):", err);
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
        // Grab current UserID from session (ensure you set this during login!)
        const UserID = localStorage.getItem('UserID') || 0;

        await fetch('/api/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                data: dataString,
                UserID: UserID
            })
        });
    } catch (err) {
        console.error("Database logging failed:", err);
    }
}


function startDispatchPolling() {
    setInterval(async () => {
        const UnitID = localStorage.getItem('UnitID');
        if (!UnitID) return;

        try {
            const response = await fetch(`/api/dispatch/status/${UnitID}`);
            if (!response.ok) return;

            const status = await response.json();
            
            // Logic: Call is active AND database says narcotics are 'Needed'
            if (status.ActiveCall > 0 && status.Needed === 1 && !hasSentArmCommand) {
                console.log("Narcotics Needed for Case. Arming...");
                
                if (port && port.writable) {
                    armNarcoticsBox(status.ServiceUUID);
                    hasSentArmCommand = true;
                } else {
                    console.warn("Hardware not connected, but narcotics are needed!");
                }
            } 
            
            // Reset: If call is cleared OR dispatcher changes 'Needed' back to 0
            else if (status.ActiveCall === 0 || status.Needed === 0) {
                if (hasSentArmCommand) {
                    console.log("Database cleared. Sending DISARM to hardware...");
                    disarmNarcoticsBox();
                }
            }
        } catch (err) {
            console.error("Polling error:", err);
        }
    }, 5000); 
}
