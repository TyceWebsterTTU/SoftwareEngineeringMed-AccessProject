let port;
let reader;
let isArmed = false;
let checkInterval;

async function login() {
    const usr = document.getElementById('txtUsrName').value;
    const pass = document.getElementById('txtPassword').value;

    // Basic validation to prevent unnecessary network calls
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

        // Check if the server actually sent back JSON
        const contentType = fetchRes.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new TypeError("Oops, we didn't get JSON back from the server!");
        }

        const data = await fetchRes.json();

        if (data.success) {
            localStorage.setItem('userID', data.user.UserID);
            localStorage.setItem('ambulanceID', data.user.AssignedAmbulance);
            
            // Helpful for debugging: Log the role before redirecting
            console.log("Redirecting user with role:", data.user.Role);
            window.location.href = data.isAdmin ? "admin.html" : "dashboard.html";
        } else {
            alert(data.message || "Invalid credentials");
        }
    } catch (err) {
        console.error("Critical Login Error:", err);
        alert("Connection failed. Make sure you are accessing the site via port 3000.");
    }
}

function logout() {
    // 1. Redirect first
    window.location.href = "index.html";

    // 2. Clear fields ONLY if they exist (using the optional chaining we discussed)
    const userField = document.getElementById("txtUsrName");
    const passField = document.getElementById("txtPassword");

    if (userField) userField.value = '';
    if (passField) passField.value = '';
}

async function LoadUserData() {
    try {
        // CHANGED: Use relative path
        const fetchRes = await fetch("/user", {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });
        const results = await fetchRes.json();

        const tableHead = document.getElementById("tableHead");
        const tableBody = document.getElementById("tableBody");

        tableHead.innerHTML = "";
        tableBody.innerHTML = "";

        if (results.length === 0) {
            tableBody.innerHTML = "<tr><td>No data found</td></tr>";
            return;
        }

        const headers = Object.keys(results[0]).filter(h => h != 'Password');
        let headRow = "<tr>";
        headers.forEach(h => headRow += `<th>${h}</th>`);
        headRow += "<th>Delete/Edit User</th>";
        headRow += "</tr>";
        tableHead.innerHTML = headRow;

        results.forEach(row => {
            let rowHTML = "<tr class='text-center'>";
            headers.forEach(h => rowHTML += `<td class="text-center">${row[h]}</td>`);
            
            // ADD THIS LINE: It creates a red delete button for each row
            // We assume your table has a column called 'UserID'
            rowHTML += `
                <td style="width: 150px;">
                    <div class="d-flex justify-content-center gap-2">
                        <button class="btn btn-danger d-flex align-items-center px-3" onclick="removeUsers(${row.UserID})">
                            Delete
                        </button>
                        <button class="btn btn-success d-flex align-items-center px-3" onclick="editUsers(${row.UserID})">
                            Edit
                        </button>
                    </div>
                </td>`;
            rowHTML += "</tr>";
            tableBody.innerHTML += rowHTML;
        });
    } catch (err) {
        console.error("Error loading data:", err);
    }
}

async function addUsers() {
    // These names match the backend req.body variables exactly
    const user = {
        userID: document.getElementById("newUserID")?.value, // Added ID
        username: document.getElementById("newUsername").value,
        password: document.getElementById("newPassword")?.value, // Added hashed Password
        role: document.getElementById("newRole")?.value, // Added Role
        assignedAmbulance: document.getElementById("newAmbulance")?.value // Added Ambulance
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
        } else {
            alert("User changes saved!");
            location.reload();
        }
    } catch (err) {
        console.error("Save user edit error:", err);
        alert("Failed to save user changes.");
    }

}

async function loadTestData() {
    try {
        // CHANGED: Use relative path
        const fetchRes = await fetch("/test");
        const data = await fetchRes.json();
        const results = data.results;

        const tableHead = document.getElementById("tableHead");
        const tableBody = document.getElementById("tableBody");

        tableHead.innerHTML = "";
        tableBody.innerHTML = "";

        if (!results || results.length === 0) {
            tableBody.innerHTML = "<tr><td>No data found</td></tr>";
            return;
        }

        const headers = Object.keys(results[0]);
        let headRow = "<tr>";
        headers.forEach(h => headRow += `<th>${h}</th>`);
        headRow += "</tr>";
        tableHead.innerHTML = headRow;

        results.forEach(row => {
            let rowHTML = "<tr>";
            headers.forEach(h => rowHTML += `<td>${row[h]}</td>`);
            rowHTML += "</tr>";
            tableBody.innerHTML += rowHTML;
        });
    } catch (err) {
        console.error("Error loading data:", err);
    }
}
    //Web Serial Logic
/**
 * 1. CONNECT TO ESP32
 * Triggered by the "Connect" button in your HTML.
 */
// Wrap the listener so it doesn't crash on the login page
const connectBtn = document.getElementById('connect-btn');

if (connectBtn) {
    connectBtn.addEventListener('click', async () => {
        const statusLabel = document.getElementById('serial-status');
        const terminal = document.getElementById('live-terminal');
        
        try {
            port = await navigator.serial.requestPort();
            await port.open({ baudRate: 115200 });
            
            statusLabel.innerText = "Connected";
            statusLabel.className = "badge bg-success fs-6";
            terminal.innerHTML += `<div class="text-info">> Hardware Linked. System ready for Dispatch.</div>`;

            const textDecoder = new TextDecoderStream();
            port.readable.pipeTo(textDecoder.writable);
            reader = textDecoder.readable.getReader();

            listenToESP32();
        } catch (error) {
            console.error("Serial Connection Failed:", error);
            if(statusLabel) {
                statusLabel.innerText = "Connection Failed";
                statusLabel.className = "badge bg-danger fs-6";
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
async function armNarcoticsBox(paramedicUUID) {
    if (port && port.writable) {
        const encoder = new TextEncoder();
        const writer = port.writable.getWriter();
        
        // Send "ARM:" prefix so ESP32 knows to switch to Scan Mode
        const command = `ARM:${paramedicUUID}\n`;
        await writer.write(encoder.encode(command));
        
        const terminal = document.getElementById('live-terminal');
        terminal.innerHTML += `<div class="text-warning">> ARMING: Searching for UUID ${paramedicUUID}...</div>`;
        
        writer.releaseLock();
        isArmed = true;
    } else {
        console.error("Cannot arm: ESP32 not connected via Web Serial.");
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
function startDispatchPolling() {
    const ambulanceID = localStorage.getItem('ambulanceID');
    
    if (!ambulanceID) {
        console.error("No Ambulance ID found. Polling cannot start.");
        return;
    }

    setInterval(async () => {
        try {
            // Ask the backend for the current status of this ambulance
            const response = await fetch(`/api/dispatch/status/${ambulanceID}`);
            const status = await response.json();

            // Logic: If a call is active and we haven't armed the box yet
            if (status.ActiveCall > 0 && !isArmed) {
                console.log("NEW CALL DETECTED: Arming Box...");
                
                // Trigger the Web Serial command to the ESP32
                armNarcoticsBox(status.ServiceUUID); 
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
if (window.location.pathname.includes("dashboard.html")) {
    startStatusCheck();
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