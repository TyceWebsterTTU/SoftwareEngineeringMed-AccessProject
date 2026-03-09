let port;
let reader;

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

function showAlerts(message, type = "success") {
    const alertPlaceholder = document.getElementById('globalAlertPlaceholder');
    if (!alertPlaceholder) return;
    const wrapper = document.createElement('div');
    wrapper.style.pointerEvents = "auto"

    wrapper.innerHTML = 
        `<div class="alert alert-${type} shadow-lg border border-2 border-secondary text-center p-4 animate__animated animate__zoomIn" 
             role="alert" 
             style="min-width: 350px; border-radius: 15px; background: white; pointer-events: auto;">
            <div class="mb-3">
                <i class="bi ${type === 'success' ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-danger'}" 
                   style="font-size: 3rem;"></i>
            </div>
            <h4 class="alert-heading fw-bold text-dark">${type === 'success' ? 'Success!' : 'Error!'}</h4>
            <p class="mb-0 text-dark fw-bold">${message}</p>
            <button type="button" class="btn ${type === 'success' ? 'btn-success' : 'btn-danger'} mt-3 px-4 fw-bold" id="alertOkBtn">OK</button>
        </div>`

    alertPlaceholder.innerHTML = '';
    alertPlaceholder.append(wrapper);

    // Manual click handler for the OK button
    const okBtn = wrapper.querySelector('#alertOkBtn');
    okBtn.addEventListener('click', () => {
        const bsAlert = bootstrap.Alert.getOrCreateInstance(wrapper.querySelector('.alert'));
        bsAlert.close();
        wrapper.remove();
    });

    // Auto-close after 3 seconds (increased for better readability)
    setTimeout(() => {
        if (wrapper.parentNode) {
            const bsAlert = bootstrap.Alert.getOrCreateInstance(wrapper.querySelector('.alert'));
            if (bsAlert) bsAlert.close();
            setTimeout(() => wrapper.remove(), 500);
        }
    }, 5000);
}

async function login() {
    const usr = document.getElementById('txtUsrName').value;
    const pass = document.getElementById('txtPassword').value;

    if (!usr || !pass) {
        showAlerts("Please enter both username and password", "danger");
        return;
    }

    try {
        const fetchRes = await fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: usr, password: pass })
        });

        const contentType = fetchRes.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new TypeError("Oops, we didn't get JSON back from the server!");
        }

        const data = await fetchRes.json();
        console.log("Login Response Data:", data); // Debugging: See what the server sent

        if (data.success) {
            // Store common user data
            localStorage.setItem('UserID', data.user.UserID);
            localStorage.setItem('Username', data.user.Username)
            localStorage.setItem('UnitID', data.user.UnitID);
            localStorage.setItem('sessionID', data.sessionID);
            localStorage.setItem('Role', data.user.Role);
            // SAVE SERVICE UUID (Check casing from backend)
            // We use a fallback here just in case the backend uses lowercase
            const uuid = data?.user?.ServiceUUID;
            if (uuid) {
                localStorage.setItem('ServiceUUID', uuid);
            } else {
                console.warn("UUID not found in server response!");
            }
            
            
            console.log("Stored UUID in Browser:", localStorage.getItem('ServiceUUID'));

            const rawRole = data.user.Role;
            const role = rawRole.charAt(0).toUpperCase() + rawRole.slice(1).toLowerCase();
            
            console.log("Redirecting user with role:", role);
            
            if (data.isAdmin || role === 'Admin') {
                window.location.href = "admin.html";
            } else if (role === 'Dispatcher') {
                window.location.href = "dispatcher.html";
            } else if (role === 'Paramedic') {
                window.location.href = "paramedic.html";
            } else {
                console.error("Unknown role detected:", role);
                showAlerts("Account setup error: Role not recognized.", "danger");
            }
        } else {
            showAlerts("Invalid credentials", "danger");
            await failedLogin(usr)
        }
    } catch (err) {
        console.error("Critical Login Error:", err);
        alert("Connection failed. Check your Node.js server logs.");
    }
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

async function failedLogin(username) {
    // if(!username) {
    //     console.log("No username entered")
    //     username = null;
    // }

    console.log("Logout Failed")
    try {
        const fetchRes = await fetch('/api/failedLogins', {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ usr: username})
        })
        const results = await fetchRes.json()

        if (!fetchRes.ok) {
            console.error("Server rejected logout update:", fetchRes.status);
        } else {
            console.log("Connected to database")
        }

    } catch (err) {
        console.error("Error:", err)
    }
}

    //Web Serial Logic
/**
 * 1. CONNECT TO ESP32
 * Triggered by the "Connect" button in your HTML.
 */
const connectBtn = document.getElementById('connect-btn');

if (connectBtn) {
    connectBtn.addEventListener('click', async () => {
        const statusLabel = document.getElementById('serial-status');
        const terminal = document.getElementById('live-terminal');
        
        try {
            // 1. If we don't have a port object yet, ask the user to pick one
            if (!port) {
                port = await navigator.serial.requestPort();
            }

            // 2. CHECK: If the port is already open, don't call .open() again
            if (port.writable && port.readable) {
                console.log("Port is already open and active.");
            } else {
                await port.open({ baudRate: 115200 });
            }
            
            statusLabel.innerText = "Connected";
            statusLabel.className = "badge bg-success fs-6";
            terminal.innerHTML += `<div class="text-info">> Hardware Linked. System ready for Dispatch.</div>`;

            // 3. Setup the Pipe - only if the reader doesn't exist yet
            if (!reader) {
                const textDecoder = new TextDecoderStream();
                port.readable.pipeTo(textDecoder.writable);
                const inputStream = textDecoder.readable;

                reader = inputStream
                    .pipeThrough(new TransformStream(new LineBreakTransformer()))
                    .getReader();

                listenToESP32();
            }

        } catch (error) {
            // Handle the specific case where the user cancels the popup
            if (error.name === 'NotFoundError') {
                console.log("User cancelled the port selection.");
            } else {
                console.error("Serial Connection Failed:", error);
                if(statusLabel) {
                    statusLabel.innerText = "Connection Failed";
                    statusLabel.className = "badge bg-danger fs-6";
                }
            }
        }
    });
}

/**
 * 2. LISTEN FOR INCOMING DATA
 * Handles strings like "MATCH_FOUND" sent from the ESP32 hardware.
 */


/**
 * 3. SEND "ARM" COMMAND TO ESP32 (OUTGOING)
 * This is called when your Dispatch Logic detects an active call.
 */
async function armNarcoticsBox(uuid) {
    if (writer) {
        const encoder = new TextEncoder();
        // The \n is CRITICAL. Without it, the ESP32 won't trigger readStringUntil
        const data = encoder.encode(`ARM:${uuid}\n`); 
        await writer.write(data);
        console.log("Sent to ESP32: ARM:" + uuid);
    }
}


/**
 * 4. LOG DATA TO MYSQL
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