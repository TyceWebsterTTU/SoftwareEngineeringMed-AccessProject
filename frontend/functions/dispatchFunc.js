let usersTable = null;
let ambulanceTable = null;

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

async function triggerDispatch(isManualClick = true) {
    const unitID = parseInt(document.getElementById('dispatchUnitID').value);
    const caseID = parseInt(document.getElementById('dispatchCaseID').value);
    const assignmentValue = document.getElementById('assignmentType').value;

    const requiresNarcotics = (assignmentValue == "1");

    if (isManualClick && (!unitID || !caseID)) {
        alert("Please enter both a Unit ID and a Case ID.");
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
            alert(`Unit ${unitID} has been dispatched to Case ${caseID}. Narcotics Armed: ${requiresNarcotics ? 'ARMED' : 'OFF'}`);
        }

        console.log("SENDING TO SERVER:", { unitID, caseID, requiresNarcotics });

        LoadAmbulanceData();
        LoadBoxData();
    } catch (err) {
        console.error("Dispatch Error:", err);
    }
}