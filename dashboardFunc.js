async function login() {
    const usr = document.getElementById('txtUsrName').value
    const pass = document.getElementById('txtPassword').value

    if (!usr || !pass) {
        alert("Please enter username and password");
        return;
    }

    if (usr == "testing" && pass == "testing123!") {
        window.location.href = "dashboard.html";
    } else {
        alert('Invalid Login Attempt')
    }

    /* try {
        const fetchRes = await fetch("http://localhost:8000/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify ({
                username: usr,
                password: pass
            })
        });

        const data = await fetchRes.json();

        if (!fetchRes.ok || !data.success) {
            alert(data.message || "Invalid login");
            return;
        }

        // Backend decides admin vs user
        if (data.isAdmin) {
            window.location.href = "admin.html";
        } else {
            window.location.href = "dashboard.html";
        }
    } catch (err) {
        console.error("Login error:", err);
        alert("Server error. Please try again later.");
    } */
}

function logout() {
    window.location.href = "index.html"

    document.getElementById("txtUsrName").value = '';
    document.getElementById("txtPassword").value = '';
}

async function loadTestData() {
    try {
        const fetchRes = await fetch("http://localhost:8000/test");
        const data = await fetchRes.json();

        const results = data.results;

        const tableHead = document.getElementById("tableHead");
        const tableBody = document.getElementById("tableBody");

        tableHead.innerHTML = "";
        tableBody.innerHTML = "";

        if (results.length === 0) {
            tableBody.innerHTML = "<tr><td>No data found</td></tr>";
            return;
        }

        // Build table headers
        const headers = Object.keys(results[0]);
        let headRow = "<tr>";
        headers.forEach(h => headRow += `<th>${h}</th>`);
        headRow += "</tr>";
        tableHead.innerHTML = headRow;

        // Build table rows
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