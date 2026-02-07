let port;
let reader;
let isArmed = false;
let checkInterval;

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

async function login() {
    const usr = document.getElementById('txtUsrName').value;
    const pass = document.getElementById('txtPassword').value;

    if (!usr || !pass) {
        alert("Please enter both username and password");
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
            localStorage.setItem('userID', data.user.UserID);
            localStorage.setItem('ambulanceID', data.user.ambulanceID);
            localStorage.setItem('sessionID', data.sessionID);
            localStorage.setItem('Role', data.user.Role);
            // SAVE SERVICE UUID (Check casing from backend)
            // We use a fallback here just in case the backend uses lowercase
            const uuid = data?.user?.serviceUUID;
            if (uuid) {
                localStorage.setItem('serviceUUID', uuid);
            } else {
                console.warn("UUID not found in server response!");
            }
            
            
            console.log("Stored UUID in Browser:", localStorage.getItem('serviceUUID'));

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
                alert("Account setup error: Role not recognized.");
            }
        } else {
            alert(data.message || "Invalid credentials");
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

async function LoadUserData() {
    try {
        // CHANGED: Use relative path
        const fetchRes = await fetch("/user", {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });
        const results = await fetchRes.json();

        // Get the DataTable instance
        if (!usersTable) {
            usersTable = new DataTable('#tblUsers', {
                columnDefs: [
                    { targets: 0, width: "60px", className: "text-center" },  // ID
                    { targets: 3, width: "100px", className: "text-center" }, // Ambulance
                    { targets: 4, width: "160px", className: "text-center" }  // Actions
                ]
            });
        }
        // Clears old data
        usersTable.clear();

        if (results.length === 0) {
            usersTable.draw();
            return;
        }

        // 3. Add rows using the API
        results.forEach(row => {
            usersTable.row.add([
                row.UserID,
                row.Username,
                row.Role,
                row.AssignedAmbulance || 0,
                `<div class="d-flex justify-content-center gap-2">
                    <button class="btn btn-danger btn-sm" onclick="removeUsers(${row.UserID})">Delete</button>
                    <button class="btn btn-success btn-sm" onclick="editUsers(${row.UserID})">Edit</button>
                </div>`
            ]).draw(false); // 'false' keeps the current pagination page
        });

    } catch (err) {
        console.error("Error loading data:", err);
    }
}

async function LoadBoxData() {
    try {
        // CHANGED: Use relative path
        const fetchRes = await fetch("/box", {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });
        const results = await fetchRes.json();
        console.log("Box Results:", results);


        // Get the DataTable instance
        if (!boxesTable) {
            boxesTable = new DataTable('#tblCases', {
                columnDefs: [
                    { targets: 0, width: "60px", className: "text-center" }, 
                    { targets: 1, width: "100px", className: "text-center" }, 
                    { targets: 2, width: "100px", className: "text-center" },
                    { targets: 3, width: "100px", className: "text-center" },
                    { targets: 4, width: "100px", className: "text-center" }
                ]
            });
        }
        // Clears old data
        boxesTable.clear();

        if (results.length === 0) {
            boxesTable.draw();
            return;
        }

        // 3. Add rows using the API
        results.forEach(row => {
            boxesTable.row.add([
                row.CaseID,
                row.ESPID,
                row.Locked,
                row.Open,
                row.Needed
            ]).draw(false); // 'false' keeps the current pagination page
        });
    } catch (err) {
        console.error("Error loading data:", err);
    }
}

async function LoadAmbulanceData() {
    try {
        // CHANGED: Use relative path
        const fetchRes = await fetch("/ambulance", {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });
        const results = await fetchRes.json();
        console.log("Ambulance Results:", results);


        // Get the DataTable instance
        if (!ambulanceTable) {
            ambulanceTable = new DataTable('#tblAmbulance', {
                columnDefs: [
                    { targets: "_all", className: "text-center" }
                ]
            });
        }
        // Clears old data
        ambulanceTable.clear();

        if (results.length === 0) {
            ambulanceTable.draw();
            return;
        }

        // 3. Add rows using the API
        results.forEach(row => {
            ambulanceTable.row.add([
                row.UnitID,
                row.ShiftStatus,
                row.ActiveCall,
                row.CaseID,
                row.ConnectedESP
            ]).draw(false); // 'false' keeps the current pagination page
        });
    } catch (err) {
        console.error("Error loading data:", err);
    }
}

// Pulls the list of ambulance units that are currently available and loads them to the dropodown Target Ambulance Unit for the user to select
async function loadAvailableUnits() {
    const dropdown = document.getElementById('dispatchUnitID');
    if(!dropdown) return; // Don't run if the dropdown isn't on the page'

    try {
        const fetchRes = await fetch('/unitsAvailable', {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });
        const availableUnits = await fetchRes.json();
        console.log("Available Units Response:", availableUnits);

        dropdown.innerHTML = '<option value="">-- Select Available Unit --</option>';

        availableUnits.forEach(unit => {
            const option = document.createElement('option');

            option.value = unit.UnitID;
            option.textContent = `Unit #${unit.UnitID}`;
            dropdown.appendChild(option);
        });
    } catch (err) {
        console.error("Load available unit error:", err);
        alert("Failed to open load available unit dialog.");
    }
}

async function addUsers() {
    // These names match the backend req.body variables exactly
    const user = {
        userID: uuid(), // Added ID
        username: document.getElementById("newUsername").value,
        password: document.getElementById("newPassword")?.value, // Added hashed Password
        role: document.getElementById("newRole")?.value, // Added Role
        AssignedAmbulance: document.getElementById("newAmbulance")?.value // Added Ambulance
    };

    const fetchRes = await fetch("/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user)
    });

    if (!fetchRes.ok) {
        alert("Failed to add user");
    } else {
        alert("User added!");
        LoadUserData();
    }
}

async function removeUsers(id) {
    if (!confirm("Are you sure want to delete this user?")) return;

    // FIXED: Use backticks (``) so the ${id} variable actually works
    const fetchRes = await fetch(`/user/${id}`, {
        method: "DELETE"
    });

    if (!fetchRes.ok) {
        alert("Failed to delete user");
    } else {
        LoadUserData();
    }
}

function editUsers(userID) {
    try {
        //Find the row in the table that has this ID
        const row = document.querySelector(`button[onclick="editUsers(${userID})"]`).closest("tr").children;
        
        //Populate your HTML modal fields
        document.getElementById("editUserID").value = userID;
        document.getElementById("editUsername").value = row[1].textContent;
        document.getElementById('editPassword').value = "";
        document.getElementById("editRole").value = row[2].textContent;
        document.getElementById("editAmbulanceNum").value = row[3].textContent;

        // Open the bootstrap modal you already have in your HTML
        const myModal = new bootstrap.Modal(document.getElementById('editUserModal'));
        myModal.show();
    } catch (err) {
        console.error("Edit user error:", err);
        alert("Failed to open edit user dialog.");
    }
}

async function saveUserEdits() {
    const userID = document.getElementById("editUserID").value;
    const updatedUser = {
        username: document.getElementById("editUsername").value,
        password: document.getElementById("editPassword").value,
        role: document.getElementById("editRole").value,
        ambulanceNum: document.getElementById("editAmbulanceNum").value
    };

    try {
        const fetchRes = await fetch(`/user/${userID}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json"},
            body: JSON.stringify(updatedUser)
        })

        // Check if server sent something back
        if (!fetchRes.ok) {
            const err = await fetchRes.json();
            alert("Error: " + err.message);
        } 

        // Close the modal
        const modalEl = document.getElementById('editUserModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();

        // Refresh table data only
        LoadUserData();
        // Optional nice UX feedback
        alert("User changes saved!");
    } catch (err) {
        console.error("Save user edit error:", err);
        alert("Failed to save user changes.");
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
async function startDispatchPolling() {
    const ambulanceID = localStorage.getItem('ambulanceID');
    if (!ambulanceID) return;

    setInterval(async () => {
        try {
            const response = await fetch(`/api/dispatch/status/${ambulanceID}`);
            
            // CHECK FOR 404/500 BEFORE PARSING
            if (!response.ok) {
                console.warn(`API returned error: ${response.status}`);
                return; // Stop here so we don't trigger the Syntax Error
            }

            const status = await response.json();
            if (status.ActiveCall === 1 && !isArmed) {
                armNarcoticsBox(status.serviceUUID);
            }
        } catch (err) {
            console.error("Polling Error:", err);
        }
    }, 5000);
}



// Call this when the dashboard loads
if (window.location.pathname.includes("dashboard.html")) {
    startDispatchPolling();
}

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



