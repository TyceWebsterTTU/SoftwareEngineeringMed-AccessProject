let port;
let reader;

async function login() {
    const usr = document.getElementById('txtUsrName').value
    const pass = document.getElementById('txtPassword').value

    try {
        // CHANGED: Use relative path
        const fetchRes = await fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: usr, // Matches backend req.body.username
                password: pass
            })
        });

        const data = await fetchRes.json();

        if (!fetchRes.ok || !data.success) {
            alert(data.message || "Invalid login");
            return;
        }

        if (data.isAdmin) {
            window.location.href = "admin.html";
        } else {
            window.location.href = "dashboard.html";
        }
    } catch (err) {
        console.error("Login error:", err);
        alert("Server error. Please try again later.");
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

        const headers = Object.keys(results[0]);
        let headRow = "<tr>";
        headers.forEach(h => headRow += `<th>${h}</th>`);
        headRow += "</tr>";
        tableHead.innerHTML = headRow;

        results.forEach(row => {
            let rowHTML = "<tr>";
            headers.forEach(h => rowHTML += `<td>${row[h]}</td>`);
            
            // ADD THIS LINE: It creates a red delete button for each row
            // We assume your table has a column called 'UserID'
            rowHTML += `<td>
                <button class="btn btn-danger btn-sm" onclick="removeUsers(${row.UserID})">
                    Delete
                </button>
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
        password: document.getElementById("newPassword")?.value, // Added Password
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

// --- WEB SERIAL LOGIC ---

document.getElementById('connect-btn').addEventListener('click', async () => {
    try {
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 115200 });

        const textDecoder = new TextDecoderStream();
        port.readable.pipeTo(textDecoder.writable);
        reader = textDecoder.readable.getReader();

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
                console.log("Data from ESP32:", value);
                sendDataToServer(value); 
            }
        }
    } catch (error) {
        console.error("Serial Connection Failed:", error);
    }
});

async function sendDataToServer(data) {
    await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: data }) // Matches req.body.data in backend
    });
}