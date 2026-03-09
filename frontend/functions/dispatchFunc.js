let usersTable = null;
let ambulanceTable = null;
let callsChart = null;

document.addEventListener('DOMContentLoaded', () => {
    initCallsGraph();
    loadAvailableUnits()

    setInterval(initCallsGraph, 30000)
});

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

document.addEventListener('DOMContentLoaded', displayCurrentUserInfo);

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
            usersTable = new DataTable('#tblDashboardParameds', {
                columnDefs: [
                    { targets: 0, width: "60px", className: "text-center" },  // ID
                    { targets: 3, width: "100px", className: "text-center" }, // Ambulance
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
            if(row.Role === "Paramedic"){
                usersTable.row.add([
                    row.UserID,
                    row.Username,
                    row.Role,
                    row.AssignedAmbulance || 0
                ]).draw(false); // 'false' keeps the current pagination page
            }
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
            ambulanceTable = new DataTable('#tblDashboardUnits', {
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
        loadAvailableUnits()
    } catch (err) {
        console.error("Dispatch Error:", err);
    }
}