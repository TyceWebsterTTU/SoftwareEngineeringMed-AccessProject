let port;
let reader;

let deleteID = null
let deleteType = null
let callsChart = null;
let loginTable = null;
let usersTable = null;
let boxesTable = null;
let ambulanceTable = null;
let failedLoginsTable = null;
let totalOnlineUnitsTable = null;
let totalOfflineUnitsTable = null;
let overrideLogsTable = null;

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

document.addEventListener('DOMContentLoaded', displayCurrentUserInfo);
// Refreshes all functions in admin
document.addEventListener('DOMContentLoaded', () => {
    totalFailedLogins();
    totalActiveUnits();
    totalOffilineUnits();
    initCallsGraph();
    LoadAmbulanceData();
    LoadUserData();
    LoadBoxData();

    setInterval(totalFailedLogins, 30000)
    setInterval(totalActiveUnits, 30000)
    setInterval(totalOffilineUnits, 30000)
    setInterval(initCallsGraph, 30000)
    setInterval(LoadAmbulanceData, 5000)
    setInterval(LoadUserData, 5000)
    setInterval(LoadBoxData, 5000)
});

async function initCallsGraph() {
    try {
        const fetchRes = await fetch('/api/callsPerWeek')
        const data = await fetchRes.json()

        const labels = data.map(row => row.WeekStart)
        const counts = data.map(row => row.CallCount)

        const ctx = document.getElementById('canGraph').getContext('2d');

        if (callsChart) {
            callsChart.data.labels = labels;
            callsChart.data.datasets[0].data = counts
            callsChart.update()
        } else {
            callsChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Calls Completed',
                        data: counts,
                        borderColor: '#0d6efd',
                        backgroundColor: 'rgba(13, 110, 253, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointBackgroundColor: '#0d6efd'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false, // Important: Allows graph to follow the 300px height
                    plugins: {
                        legend: { display: false },
                        tooltip: { mode: 'index', intersect: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { display: true, color: '#f0f0f0' },
                            ticks: { stepSize: 1 }
                        },
                        x: {
                            grid: { display: false }
                        }
                    }
                }
            });
        }
    } catch (err) {
        console.error("Failed to load graph:", err);
    }
}

function displayCurrentUserInfo() {
    const username = localStorage.getItem('Username');
    const displayUserName = document.getElementById('displayUsername');
    const role = localStorage.getItem('Role')
    const displayRole = document.getElementById('displayRole')

    const ambulance = localStorage.getItem('UnitID')
    const displayAmbulance = document.getElementById('displayAmbulance')

    if (username && displayUserName) {
        displayUserName.textContent = " " + username; // Adds the name next to the icon
    }

    if(role && displayRole){
        displayRole.textContent = displayRole.textContent + role;
    }

    if(ambulance && displayAmbulance){
        displayAmbulance.textContent = displayAmbulance.textContent + ambulance;
    }
}

async function showFailedLogins() {
    try {
        const fetchRes = await fetch('/api/failedLogins', {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });

        const data = await fetchRes.json();

        // Check if the response is actually an error object
        if (!fetchRes.ok || data.Error) {
            console.error("Server Error:", data.Error);
            return;
        }

        // Get the DataTable instance
        if (!failedLoginsTable) {
            failedLoginsTable = new DataTable('#tblFailedLogins', {
                searching: false,   // Removes the Search bar
                paging: false,      // Removes Pagination (Next/Prev buttons)
                info: false,        // Removes "Showing 1 of X entries" text
                lengthChange: false,
                order: [[1, 'desc']],
                columnDefs: [
                    { targets: 0, width: "60px", className: "text-center",  orderable: false },
                    { targets: 1, width: "60px", className: "text-center" }
                ]
            });
        }
        // Clears old data
        failedLoginsTable.clear();

        // Add rows using the API
        data.forEach(row => {
            failedLoginsTable.row.add([
                row.Username,
                row.TimeStamp
            ]); // 'false' keeps the current pagination page
        });

        failedLoginsTable.draw();

        const myModal = new bootstrap.Modal(document.getElementById('failedLoginsModal'))
        myModal.show()
    } catch (err) {
        console.error("Error loading data:", err);
    }
}

async function totalFailedLogins() {
    try {
        const fetchRes = await fetch('/api/failedLogins/count', {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });

        const data = await fetchRes.json();

        // Check if the response is actually an error object
        if (!fetchRes.ok || data.Error) {
            console.error("Server Error:", data.Error);
            return;
        }

        const displayElement = document.getElementById('failedLoginCount')
        if(displayElement) {
            // If it's an array, grab the first item. If not, use 'data'
            const result = Array.isArray(data) ? data[0] : data;
            
            // Extract the number (checking common SQL keys like 'total', 'count', or 'count(*)')
            const finalCount = result.total ?? result.count ?? Object.values(result)[0] ?? 0;
            
            displayElement.innerText = finalCount;
        }
    } catch (err) {
        console.error("Error loading data:", err);
    }
}

async function showTotalActiveUnits() {
    try {
        const fetchRes = await fetch('/api/activeUnits', {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });

        const data = await fetchRes.json();

        // Check if the response is actually an error object
        if (!fetchRes.ok || data.Error) {
            console.error("Server Error:", data.Error);
            return;
        }
        // Get the DataTable instance
        if (!totalOnlineUnitsTable) {
            totalOnlineUnitsTable = new DataTable('#tblOnlineUnits', {
                searching: false,   // Removes the Search bar
                paging: false,      // Removes Pagination (Next/Prev buttons)
                info: false,        // Removes "Showing 1 of X entries" text
                lengthChange: false,
                columnDefs: [
                    { targets: 0, width: "60px", className: "text-center" },
                    { targets: 1, width: "60px", className: "text-center" },
                    { targets: 2, width: "60px", className: "text-center" }
                ]
            });
        }
        // Clears old data
        totalOnlineUnitsTable.clear();

        // Add rows using the API
        data.forEach(row => {
            totalOnlineUnitsTable.row.add([
                row.UnitID,
                row.CaseID,
                row.ConnectedESP
            ]); // 'false' keeps the current pagination page
        });

        totalOnlineUnitsTable.draw();

        const myModal = new bootstrap.Modal(document.getElementById('onlineUnitsModal'))
        myModal.show()
    } catch (err) {
        console.error("Error loading data:", err);
    }
}

async function totalActiveUnits() {
    try {
        const fetchRes = await fetch('/api/activeUnits/count', {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });

        const data = await fetchRes.json();

        // Check if the response is actually an error object
        if (!fetchRes.ok || data.Error) {
            console.error("Server Error:", data.Error);
            return;
        }

        const displayElement = document.getElementById('totalActiveUnits')
        if(displayElement) {
            // If it's an array, grab the first item. If not, use 'data'
            const result = Array.isArray(data) ? data[0] : data;
            
            // Extract the number (checking common SQL keys like 'total', 'count', or 'count(*)')
            const finalCount = result.total ?? result.count ?? Object.values(result)[0] ?? 0;
            
            displayElement.innerText = finalCount;
        }
    } catch (err) {
        console.error("Error loading data:", err);
    }
}

async function totalOffilineUnits() {
    try {
        const fetchRes = await fetch('/api/inactiveUnits/count', {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });

        const data = await fetchRes.json();

        // Check if the response is actually an error object
        if (!fetchRes.ok || data.Error) {
            console.error("Server Error:", data.Error);
            return;
        }

        const displayElement = document.getElementById('totalOfflineUnits')
        if(displayElement) {
            // If it's an array, grab the first item. If not, use 'data'
            const result = Array.isArray(data) ? data[0] : data;
            
            // Extract the number (checking common SQL keys like 'total', 'count', or 'count(*)')
            const finalCount = result.total ?? result.count ?? Object.values(result)[0] ?? 0;
            
            displayElement.innerText = finalCount;
        }
    } catch (err) {
        console.error("Error loading data:", err);
    }
}

async function showTotalOfflineUnits() {
    try {
        const fetchRes = await fetch('/api/inactiveUnits', {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });

        const data = await fetchRes.json();

        // Check if the response is actually an error object
        if (!fetchRes.ok || data.Error) {
            console.error("Server Error:", data.Error);
            return;
        }
        // Get the DataTable instance
        if (!totalOfflineUnitsTable) {
            totalOfflineUnitsTable = new DataTable('#tblOfflineUnits', {
                searching: false,   // Removes the Search bar
                paging: false,      // Removes Pagination (Next/Prev buttons)
                info: false,        // Removes "Showing 1 of X entries" text
                lengthChange: false,
                columnDefs: [
                    { targets: 0, width: "60px", className: "text-center" },
                    { targets: 1, width: "60px", className: "text-center" },
                    { targets: 2, width: "60px", className: "text-center" }
                ]
            });
        }
        // Clears old data
        totalOfflineUnitsTable.clear();

        // Add rows using the API
        data.forEach(row => {
            totalOfflineUnitsTable.row.add([
                row.UnitID,
                row.CaseID,
                row.ConnectedESP
            ]); // 'false' keeps the current pagination page
        });

        totalOfflineUnitsTable.draw();

        const myModal = new bootstrap.Modal(document.getElementById('offlineUnitsModal'))
        myModal.show()
    } catch (err) {
        console.error("Error loading data:", err);
    }
}

async function showRecentOverrideLogs() {
    try {
        const fetchRes = await fetch('/api/showOverrideLogs', {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });

        const data = await fetchRes.json();

        // Check if the response is actually an error object
        if (!fetchRes.ok || data.Error) {
            console.error("Server Error:", data.Error);
            return;
        }
        // Get the DataTable instance
        if (!overrideLogsTable) {
            overrideLogsTable = new DataTable('#tblOverrideLogs', {
                searching: false,   // Removes the Search bar
                paging: false,      // Removes Pagination (Next/Prev buttons)
                info: false,        // Removes "Showing 1 of X entries" text
                lengthChange: false,
                columnDefs: [
                    { targets: 0, width: "60px", className: "text-center" },
                    { targets: 1, width: "60px", className: "text-center" }
                ]
            });
        }
        // Clears old data
        overrideLogsTable.clear();

        // Add rows using the API
        data.forEach(row => {
            overrideLogsTable.row.add([
                row.UnitID,
                row.OverrideTime 
            ]); // 'false' keeps the current pagination page
        });

        overrideLogsTable.draw();

        const myModal = new bootstrap.Modal(document.getElementById('overrideLogsModal'))
        myModal.show()
    } catch (err) {
        console.error("Error loading data:", err);
    }
}

async function logout() {
    // Update logout timestamp
    await updateLogout()
    localStorage.clear()

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

async function LoadLoginData() {
    try {
        const fetchRes = await fetch("/loginData", {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });

        const data = await fetchRes.json();

        // Check if the response is actually an error object
        if (!fetchRes.ok || data.Error) {
            console.error("Server Error:", data.Error);
            return;
        }

        // Get the DataTable instance
        if (!loginTable) {
            loginTable = new DataTable('#tblLogins', {
                columnDefs: [
                    { targets: 0, width: "60px", className: "text-center" },
                    { targets: 1, width: "100px", className: "text-center" },
                    { targets: 2, width: "160px", className: "text-center" } 
                ]
            });
        }
        // Clears old data
        loginTable.clear();

        // Add rows using the API
        data.forEach(row => {
            loginTable.row.add([
                row.Username,
                row.LastLoginTime,
                row.LastLogoutTime
            ]); // 'false' keeps the current pagination page
        });

        loginTable.draw();
    } catch (err) {
        console.error("Error loading data:", err);
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
                    { targets: [1, 2], className: "text-center" },
                    { targets: 3, orderable: false, className: "text-center" }  // Actions
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
            const actionButtons = `
                <div class="d-flex justify-content-center gap-2">
                    <button class="btn btn-danger btn-sm" onclick="confirmDelete('${row.UserID}', 'user')">Delete</button>
                    <button class="btn btn-success btn-sm" onclick="editUsers('${row.UserID}')">Edit</button>
                </div>`;
            usersTable.row.add([
                row.Username,
                row.Role,
                row.AssignedAmbulance || 0,
                actionButtons
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
                    {
                        targets: [1, 2],
                        className: "text-center",
                        render: function (data, type, row) {
                            if (data == 1) {
                                return `<button class="btn btn-sm btn-success w-75 shadow-sm" style="pointer-events: none;">Yes</button>`
                            } else {
                                return `<button class="btn btn-sm btn-secondary w-75 shadow-sm" style="pointer-events: none;">No</button>`
                            }
                        }
                    },
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
            const deleteBtn = `<button class="btn btn-danger btn-sm" onclick="confirmDelete('${row.UnitID}', 'unit')">Delete</button>`;
            const editBtn = `<button class="btn btn-success btn-sm" onclick="editUnits('${row.UnitID}')">Edit</button>`;

            const securityDisplay = row.OverrideActive == 1
                ? `<button class="btn btn-warning btn-sm" onclick="overrideReset('${row.UnitID}')">RESET OVERRIDE</button>`
                : `<span class="badge bg-success">SECURE</span>`;
            ambulanceTable.row.add([
                row.UnitID,
                row.ShiftStatus,
                row.ActiveCall,
                row.CaseID,
                row.ConnectedESP,
                `<div class="d-flex justify-content-center gap-2">${deleteBtn}${editBtn}</div>`,
                securityDisplay
            ]).draw(false); // 'false' keeps the current pagination page
        });
    } catch (err) {
        console.error("Error loading data:", err);
    }
}

async function addUnit() {
    const unit = {
        UnitID: document.getElementById("newUnitID").value,
        CaseID: document.getElementById("newCaseID").value,
        ConnectedESP: document.getElementById("newESP32ID").value
    };

    const fetchRes = await fetch("/api/unit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(unit)
    });

    if (!fetchRes.ok) {
        showAlerts("Failed to add unit", "danger");
    } else {
        showAlerts("Unit added!", "success");
        // --- CLEAR FIELDS HERE ---
        document.getElementById('newUnitID').value = '';
        document.getElementById('newCaseID').value = '';
        document.getElementById('newESP32ID').value = '';
        LoadAmbulanceData();
    }
}

function confirmDelete(id, type) {
    console.log("Delete triggered for:", id, type);

    deleteID = id;
    deleteType = type; // Added semicolon
    
    const title = document.getElementById('deleteModalTitle');
    const msg = document.getElementById('deleteModalMessage');

    // Safety check: if these don't exist in HTML, the code stops here
    if (!title || !msg) {
        console.error("Modal elements not found in HTML. Check your IDs.");
        return;
    }

    if (type === 'user') {
        title.innerText = "Confirm Delete";
        msg.innerText = "Are you sure you want to delete this user?";
    } else {
        title.innerText = "Confirm Delete";
        msg.innerText = "Are you sure you want to delete this unit?";
    }

    // Try-Catch to catch Bootstrap initialization errors
    try {
        const modalEl = document.getElementById('deleteConfirmModal');
        const deleteModal = new bootstrap.Modal(modalEl);
        deleteModal.show();
    } catch (err) {
        console.error("Bootstrap Modal Error:", err);
    }
}

document.getElementById('confirmDeleteBtn').onclick = async () => {
    if (!deleteID || !deleteType) return;

    // Use /unit/ and /user/ based on your backend routes
    const apiPath = deleteType === 'user' ? `/user/${deleteID}` : `/unit/${deleteID}`;

    try {
        const fetchRes = await fetch(apiPath, { method: "DELETE" });

        // Hide modal
        const modalEl = document.getElementById('deleteConfirmModal');
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) modalInstance.hide();

        if (!fetchRes.ok) {
            showAlerts(`Failed to delete ${deleteType}`, "danger");
        } else {
            showAlerts(`${deleteType.charAt(0).toUpperCase() + deleteType.slice(1)} deleted!`, "success");
            // Refresh tables
            if (deleteType === 'user') LoadUserData();
            else LoadAmbulanceData();
        }
    } catch (err) {
        console.error("Error during delete:", err);
        showAlerts("A network error occurred.", "danger");
    }

    deleteID = null
    deleteType = null
}

function editUnits(UnitID) {
    try {
        //Find the row in the table that has this ID
        const row = document.querySelector(`button[onclick="editUnits('${UnitID}')"]`).closest("tr").children;

        const onShiftText = row[1].textContent.trim()
        const activeCallText = row[2].textContent.trim()

        document.getElementById("editUnitID").value = UnitID
        
        //Populate your HTML modal fields
        document.getElementById("editShiftStatus").value = (onShiftText == "Yes") ? "1" : "0"
        document.getElementById('editActiveCall').value = (activeCallText == "Yes") ? "1" : "0"
        document.getElementById("editCaseID").value = row[3].textContent;
        document.getElementById("editConnectedESP").value = row[4].textContent;

        // Open the bootstrap modal you already have in your HTML
        const myModal = new bootstrap.Modal(document.getElementById('editUnitModal'));
        myModal.show();
    } catch (err) {
        console.error("Edit unit error:", err);
        showAlerts("Failed to show unit dialog", "danger");
    }
}

async function saveUnitEdits() {
    const UnitID = document.getElementById("editUnitID").value;
    const updatedUnit = {
        ShiftStatus: document.getElementById("editShiftStatus").value,
        ActiveCall: document.getElementById("editActiveCall").value,
        CaseID: document.getElementById("editCaseID").value,
        ConnectedESP: document.getElementById("editConnectedESP").value
    };

    try {
        const fetchRes = await fetch(`/unit/${UnitID}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json"},
            body: JSON.stringify(updatedUnit)
        })

        // Check if server sent something back
        if (!fetchRes.ok) {
            const err = await fetchRes.json();
            showAlerts("Error: " + err.message, "danger");
        } 

        // Close the modal
        const modalEl = document.getElementById('editUnitModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();

        // Refresh table data only
        LoadAmbulanceData();
        // Optional nice UX feedback
        showAlerts("Unit changes saved!", "success");
    } catch (err) {
        console.error("Save unit edit error:", err);
        showAlerts("Failed to save unit changes.", "danger");
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

async function overrideReset(UnitID) {
    if (!confirm("Remote reset Unit #" + UnitID + "?")) return;
    try {
        const fetchRes = await fetch("/api/resetOverride", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ UnitID: UnitID })
        })
        if (await fetchRes.json()) {
            showAlerts("Reset signal sent. Hardware will relock shortly.", "success");
            LoadAmbulanceData();
        }
    } catch (err) {
        console.error(err);
    }
}

async function addUsers() {
    // These names match the backend req.body variables exactly
    const user = {
        UserID: uuid.v4(), // Added ID
        username: document.getElementById("newUsername").value,
        password: document.getElementById("newPassword")?.value, // Added hashed Password
        role: document.getElementById("newRole")?.value, // Added Role
        AssignedAmbulance: document.getElementById("newAmbulance").value || 0 // Added Ambulance
    };

    let missingFields = []

    if(!user.username) missingFields.push("Username")
    if(!user.password) missingFields.push("Password")
    if(!user.role) missingFields.push("Role")
    if(!user.AssignedAmbulance) missingFields.push("Assigned Ambulance")

    if(missingFields.length > 0) {
        const errorMessage = "Please fill in the following: " + missingFields.join(", ")
        showAlerts(errorMessage, "danger")
        return
    }

    const fetchRes = await fetch("/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user)
    });

    if (!fetchRes.ok) {
        showAlerts("Failed to add user", "success");
    } else {
        showAlerts("User added!", "success");
        // --- CLEAR FIELDS HERE ---
        document.getElementById('newUsername').value = '';
        document.getElementById('newPassword').value = '';

        const ambulanceField = document.getElementById('newAmbulance'); 
        if (ambulanceField) ambulanceField.value = '';

        LoadUserData();
    }
}

function editUsers(UserID) {
    try {
        //Find the row in the table that has this ID
        const row = document.querySelector(`button[onclick="editUsers('${UserID}')"]`).closest("tr").children;

        document.getElementById("editUserID").value = UserID
        
        //Populate your HTML modal fields
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
    const UserID = document.getElementById("editUserID").value;
    const updatedUser = {
        username: document.getElementById("editUsername").value,
        password: document.getElementById("editPassword").value,
        role: document.getElementById("editRole").value,
        ambulanceNum: document.getElementById("editAmbulanceNum").value
    };

    try {
        const fetchRes = await fetch(`/user/${UserID}`, {
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

async function triggerDispatch(isManualClick = true) {
    const unitID = parseInt(document.getElementById('dispatchUnitID').value);
    const caseID = parseInt(document.getElementById('dispatchCaseID').value);
    const assignmentValue = document.getElementById('assignmentType').value;

    const requiresNarcotics = (assignmentValue == "1");

    if (isManualClick && (!unitID || !caseID)) {
        showAlerts("Please enter both a unit and case number.", "danger");
        return;
    }

    try {
        const response = await fetch("/api/dispatch/trigger", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                unitID: unitID, 
                caseID: caseID, 
                requiresNarcotics: requiresNarcotics
            })
        });

        const data = await response.json();
        if (data.success) {
            showAlerts(`Unit ${unitID} has been dispatched to Case ${caseID}. Narcotics Armed: ${requiresNarcotics ? 'ARMED' : 'OFF'}`, "success");
        }

        console.log("SENDING TO SERVER:", { unitID, caseID, requiresNarcotics });

        LoadAmbulanceData();
        LoadBoxData();
    } catch (err) {
        console.error("Dispatch Error:", err);
    }
}