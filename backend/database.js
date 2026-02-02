// Required nodeJS applications
const express = require('express')
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = ('uuid')
const bcrypt = require('bcrypt')
const cors = require('cors');
const path = require('path');

// HTTP_PORT and activating express
const HTTPS_PORT = 3000
var app = express()

//pasword shit yippie!!!!!!!!!!!!!!!!!!!!!
const saltRounds = 10;
const regPasswod = `/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/`





app.use(express.json())
//Activating cors
app.use(cors());

// 1. Create the Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});



// Test Route
app.get('/test', async (req, res) => {
    try {
        // No .connect() needed! Pool handles it automatically.
        const [results] = await pool.query("SELECT * FROM test");
        console.log("Query Success:", results);
        res.status(200).json({ results: results });
    } catch (err) {
        console.error("Database Error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // 1. Quick Validation
    if (!username || !password) {
        return res.status(400).json({ success: false, message: "Username and password required" });
    }

    try {
        // 2. Fetch User
        const [results] = await pool.query("SELECT * FROM tblUsers WHERE Username = ?", [username]);

        // 3. Check Existence & Password
        // Using a generic message is a security best practice for finished apps
        if (results.length === 0 || !passCompare(password, results[0].Password)) {
            console.log(`[Auth] Failed attempt for: ${username}`);
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        const user = results[0];
        console.log(`[Auth] Login Success: ${username} (Role: ${user.Role})`);

        // 4. Send Clean Response
        res.json({
            success: true,
            user: {
                UserID: user.UserID,
                Username: user.Username,
                Role: user.Role,
                AssignedAmbulance: user.AssignedAmbulance 
            },
            isAdmin: user.Role === "Admin"
        });

    } catch (err) {
        console.error("[Database Error]:", err.message);
        res.status(500).json({ success: false, message: "Server error. Please try again later." });
    }
});

// Get All Users Route
app.get('/user', async (req, res) => {
    try {
        const [results] = await pool.query("SELECT UserID, Username, Role, AssignedAmbulance FROM tblUsers");
        res.json(results);
    } catch (err) {
        console.error("Fetch Users Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Create User Route
app.post('/user', async (req, res) => {
    const { userID, username, password, role, assignedAmbulance } = req.body;

    try {
        const strQuery = "INSERT INTO tblUsers (UserID, Username, Password, Role, AssignedAmbulance) VALUES (?, ?, ?, ?, ?)";
        await pool.query(strQuery, [userID, username, password, role, assignedAmbulance]);
        
        res.status(200).json({ status: "Success" });
    } catch (err) {
        console.error("Insert User Error:", err);
        res.status(404).json({ status: "Failed", error: err.message });
    }
});

// Add this to backend/database.js
app.delete('/user/:id', async (req, res) => {
    const userID = req.params.id;
    try {
        const strQuery = "DELETE FROM tblUsers WHERE UserID = ?";
        await pool.query(strQuery, [userID]);
        res.status(200).json({ status: "Success" });
    } catch (err) {
        console.error("Delete User Error:", err);
        res.status(500).json({ status: "Failed", error: err.message });
    }
});

// Allows admin to update/edit users
app.put('/user/:id', async (req, res) => {
    const userID = req.params.id;
    const { username, password, role, ambulanceNum } = req.body;

    try {
        console.log("Updating User ID:", userID);

        //Hash the password ONLY if one is provided
        let hashedPassword = null;
        if (password && password.trim() != "") {
            hashedPassword = await bcrypt.hash(password, saltRounds);
        }

        const values = [
            username || null,
            hashedPassword,
            role || null,
            ambulanceNum || null,
            userID
        ];

        /*if (updates.length == 0) {
            return res.status(400).json({ message: "No fields provided" })
        } */

        const strQuery = `UPDATE tblUsers SET Username = COALESCE(?, Username), Password = COALESCE(?, Password), Role = COALESCE(?, Role), AssignedAmbulance = COALESCE(?, AssignedAmbulance) WHERE UserID = ?`;

        const [result] = await pool.query(strQuery, values);
        if (result.affectedRows == 0) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json({ success: true });
    } catch (err) {
        console.error("Server error:", err);
        res.status(500).json({ message: "Server error" });
    }
})


// POST route to save hardware events
app.post('/api/logs', async (req, res) => {
    const { data, userID } = req.body; 
    try {
        // Ensure your tblLogs has these columns (LogID is usually AUTO_INCREMENT)
        const strQuery = "INSERT INTO tblLogs (UserID, RawData) VALUES (?, ?)";
        await pool.query(strQuery, [userID, data]);
        
        console.log(`Log Saved: User ${userID} - ${data}`);
        res.status(200).json({ status: "Success" });
    } catch (err) {
        console.error("Database Error (Logging):", err);
        res.status(500).json({ error: "Failed to save log" });
    }
});

// GET route to check for active calls and get the target UUID
app.get('/api/dispatch/status/:ambulanceID', async (req, res) => {
    const { ambulanceID } = req.params;
    try {
        const strQuery = `
            SELECT a.ActiveCall, u.ServiceUUID 
            FROM tblAmbulance a
            JOIN tblUsers u ON a.UnitID = u.AssignedAmbulance
            WHERE a.UnitID = ?`;
            
        const [rows] = await pool.query(strQuery, [ambulanceID]);
        
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({ error: "Unit not found" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/dispatch/trigger', async (req, res) => {
    const { unitID, caseID } = req.body;

    try {
        // Update the ambulance table to reflect an active call
        const strQuery = "UPDATE tblAmbulance SET ActiveCall = ? WHERE UnitID = ?";
        await pool.query(strQuery, [caseID, unitID]);

        console.log(`DISPATCH: Unit ${unitID} assigned to Case ${caseID}`);
        res.json({ success: true });
    } catch (err) {
        console.error("Update Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

function hashPassword(pass){
    return bcrypt.hash(pass, saltRounds)
}

function passCompare(plain, hashed) {
    try {
        // If 'hashed' is plain text, bcrypt might throw an error
        return bcrypt.compareSync(plain, hashed);
    } catch (err) {
        console.error("Bcrypt comparison failed. Is the DB password a valid hash?", err);
        return false;
    }
}


// This tells Node: "If someone visits the site, look for HTML files in the 'public' folder"
app.use(express.static(path.join(__dirname, 'public')));


async function checkDatabaseHealth() {
  let connected = false;
  
  while (!connected) {
    try {
      const connection = await pool.getConnection();
      console.log('DATABASE STATUS: Connected & Pool Ready');
      connection.release();
      connected = true; // Stop the loop once we succeed
    } catch (err) {
      console.log('DATABASE STATUS: Pending (MySQL is still booting up...)');
      // Wait 2 seconds before trying again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

checkDatabaseHealth();

module.exports = pool;



// 3. Start the server
app.listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log("Server running at http://your-ip:3000");
});
