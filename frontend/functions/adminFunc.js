let port;
let reader;

let loginTable = null;
let usersTable = null;
let boxesTable = null;
let ambulanceTable = null;

LoadLoginData();

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
                    <button class="btn btn-danger btn-sm" onclick="removeUsers('${row.UserID}')">Delete</button>
                    <button class="btn btn-success btn-sm" onclick="editUsers('${row.UserID}')">Edit</button>
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
                row.ConnectedESP,
                `<div class="d-flex justify-content-center gap-2">
                    <button class="btn btn-danger btn-sm" onclick="removeUnit('${row.UnitID}')">Delete</button>
                    <button class="btn btn-success btn-sm" onclick="editUnits('${row.UnitID}')">Edit</button>
                </div>`
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
        alert("Failed to add unit");
    } else {
        alert("Unit added!");
        // --- CLEAR FIELDS HERE ---
        document.getElementById('newUnitID').value = '';
        document.getElementById('newCaseID').value = '';
        document.getElementById('newESP32ID').value = '';
        LoadAmbulanceData();
    }
}

async function removeUnit(id) {
    if (!confirm("Are you sure want to delete this user?")) return;

    // FIXED: Use backticks (``) so the ${id} variable actually works
    const fetchRes = await fetch(`/unit/${id}`, {
        method: "DELETE"
    });

    if (!fetchRes.ok) {
        alert("Failed to delete unit");
    } else {
        LoadAmbulanceData();
    }
}

function editUnits(UnitID) {
    try {
        //Find the row in the table that has this ID
        const row = document.querySelector(`button[onclick="editUnits('${UnitID}')"]`).closest("tr").children;

        document.getElementById("editUnitID").value = UnitID
        
        //Populate your HTML modal fields
        document.getElementById("editShiftStatus").value = row[1].textContent;
        document.getElementById('editActiveCall').value = row[2].textContent;
        document.getElementById("editCaseID").value = row[3].textContent;
        document.getElementById("editConnectedESP").value = row[4].textContent;

        // Open the bootstrap modal you already have in your HTML
        const myModal = new bootstrap.Modal(document.getElementById('editUnitModal'));
        myModal.show();
    } catch (err) {
        console.error("Edit unit error:", err);
        alert("Failed to open edit unit dialog.");
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
            alert("Error: " + err.message);
        } 

        // Close the modal
        const modalEl = document.getElementById('editUnitModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();

        // Refresh table data only
        LoadAmbulanceData();
        // Optional nice UX feedback
        alert("Unit changes saved!");
    } catch (err) {
        console.error("Save unit edit error:", err);
        alert("Failed to save unit changes.");
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
        UserID: uuid.v4(), // Added ID
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
        // --- CLEAR FIELDS HERE ---
        document.getElementById('newUsername').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('assignedAmbulance').value = '';
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