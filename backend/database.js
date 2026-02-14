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

// Password variables
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
  timezone: 'local',
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});



// Test Route
//app.get('/test', async (req, res) => {
//    try {
//        // No .connect() needed! Pool handles it automatically.
//        const [results] = await pool.query("SELECT * FROM test");
//        console.log("Query Success:", results);
//        res.status(200).json({ results: results });
//    } catch (err) {
//        console.error("Database Error:", err);
//        res.status(500).json({ error: err.message });
//    }
//});


// Login connection
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    let sessionID = null;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: "Username and password required" });
    }

    try {
        // --- 1. FETCH USER ---
        const [rows] = await pool.query("SELECT * FROM tblUsers WHERE Username = ?", [username]);
        
        if (rows.length === 0) {
            console.log(`[Auth] User not found: ${username}`);
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        const user = rows[0];
        
        // This helps us see if 'ServiceUUID' or 'ServiceUUID' exists in the DB
        console.log("DEBUG: DB Column Names found ->", Object.keys(user)); 

        // --- 2. VALIDATE PASSWORD ---
        if (!passCompare(password, user.Password)) {
            console.log(`[Auth] Password mismatch for: ${username}`);
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        // --- 3. CREATE SESSION ---
        try {
            const [loginResult] = await pool.query(
                "INSERT INTO tblLogins (UserID, LastLoginTime, LastLogoutTime) VALUES (?, NOW(), NULL)", 
                [user.UserID]
            );
            console.log(loginResult);
            
            if (loginResult && loginResult.insertId) {
                sessionID = loginResult.insertId;
                console.log(`[Database] Session Created: ${sessionID}`);
            }    
        } catch (logErr) {
            console.error("[Logging Error]:", logErr.sqlMessage || logErr.message);
        }

        // --- 4. PREPARE & SEND RESPONSE ---
        const responseData = {
            success: true,
            sessionID: sessionID,
            user: {
                UserID: user.UserID,
                Username: user.Username,
                Role: user.Role,
                UnitID: user.AssignedAmbulance,
                // SAFETY: Checks both casings to ensure the frontend gets the data
                ServiceUUID: user.ServiceUUID || user.ServiceUUID 
            },
            isAdmin: user.Role === "Admin"
        };

        // Log the object we are about to send (Fixes the 'data' ReferenceError)
        console.log("Sending Login Response:", responseData);
        
        res.json(responseData);

    } catch (err) {
        console.error("[Critical Error]:", err.message);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});

// Logout timestamp call
app.put('/logout', async (req, res) => {
    const { sessionID } = req.body;

    try {
        await pool.query("UPDATE tblLogins SET LastLogoutTime = NOW() WHERE SessionID = ?", [sessionID])
        res.status(200).json({
            status: "Success",
            message: "Logout time updated successfully"
        })

    } catch (err) {
        console.error("Database Error:", err);
        if(!res.headersSent) {
            res.status(500).json({ 
                status: "Error",
                error: err.message
            })
        }
    }
})


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
    const { UserID, username, password, role, AssignedAmbulance } = req.body;

    try {
        const strQuery = "INSERT INTO tblUsers (UserID, Username, Password, Role, AssignedAmbulance) VALUES (?, ?, ?, ?, ?)";

        const hashPass = await hashPassword(password, saltRounds)
        await pool.query(strQuery, [UserID, username, hashPass, role, AssignedAmbulance]);
        
        res.status(200).json({ status: "Success" });
    } catch (err) {
        console.error("Insert User Error:", err);
        res.status(404).json({ status: "Failed", error: err.message });
    }
});

// Get login/logout information
app.get('/loginData', async (req, res) => {
    try {
        const strQuery = `SELECT Username, DATE_FORMAT(LastLoginTime, '%b %d, %Y - %h:%i %p') AS LastLoginTime, COALESCE(DATE_FORMAT(LastLogoutTime, '%b %d, %Y - %h:%i %p'), 'Active Session') AS LastLogoutTime FROM tblLogins LEFT JOIN tblUsers ON tblLogins.UserID = tblUsers.UserID`
        const [results] = await pool.query(strQuery);
        res.json(results);
    } catch(err) {
         return res.status(500).json({Error: err.message})
    }
})

// Add this to backend/database.js
app.delete('/user/:id', async (req, res) => {
    const UserID = req.params.id;
    try {
        const strQuery = "DELETE FROM tblUsers WHERE UserID = ?";
        await pool.query(strQuery, [UserID]);
        res.status(200).json({ status: "Success" });
    } catch (err) {
        console.error("Delete User Error:", err);
        res.status(500).json({ status: "Failed", error: err.message });
    }
});

// Allows admin to update/edit users
app.put('/user/:id', async (req, res) => {
    const UserID = req.params.id;
    const { username, password, role, ambulanceNum } = req.body;

    try {
        console.log("Updating User ID:", UserID);

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
            UserID
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

// Create Unit Route
app.post('/api/unit', async (req, res) => {
    const { UnitID, CaseID, ConnectedESP } = req.body;

    try {
        const strQuery = "INSERT INTO tblAmbulance (UnitID, ShiftStatus, ActiveCall, CaseID, ConnectedESP) VALUES (?, 1, 0, ?, ?)";
        await pool.query(strQuery, [UnitID, CaseID, ConnectedESP]);
        
        res.status(200).json({ status: "Success" });
    } catch (err) {
        console.error("Insert Unit Error:", err);
        res.status(404).json({ status: "Failed", error: err.message });
    }
});

app.delete('/unit/:id', async (req, res) => {
    const UnitID = req.params.id;
    try {
        const strQuery = "DELETE FROM tblAmbulance WHERE UnitID = ?";
        await pool.query(strQuery, [UnitID]);
        res.status(200).json({ status: "Success" });
    } catch (err) {
        console.error("Delete User Error:", err);
        res.status(500).json({ status: "Failed", error: err.message });
    }
});

//Update Units Route
app.put('/unit/:id', async (req, res) => {
    const UnitID = req.params.id;
    const { ShiftStatus, ActiveCall, CaseID, ConnectedESP } = req.body;

    try {
        const values = [
            ShiftStatus,
            ActiveCall,
            CaseID,
            ConnectedESP,
            UnitID
        ];

        /*if (updates.length == 0) {
            return res.status(400).json({ message: "No fields provided" })
        } */

        const strQuery = `UPDATE tblAmbulance SET ShiftStatus = COALESCE(?, ShiftStatus), ActiveCall = COALESCE(?, ActiveCall), CaseID = COALESCE(?, CaseID), ConnectedESP = COALESCE(?, ConnectedESP) WHERE UnitID = ?`;

        const [result] = await pool.query(strQuery, values);
        if (result.affectedRows == 0) {
            return res.status(404).json({ message: "Unit not found" });
        }
        res.json({ success: true });
    } catch (err) {
        console.error("Server error:", err);
        res.status(500).json({ message: "Server error" });
    }
})


// GET route to find available Ambulances for dispatch on a call
app.get('/unitsAvailable', async (req, res) => {
    console.log("HIT /api/units/available");
    try {
        // Pulls only the units that are on shift and available
        const [unitsAvail] = await pool.query("SELECT * FROM tblAmbulance WHERE ShiftStatus = 1 AND ActiveCall = 0");

        res.json(unitsAvail);
    } catch (err) {
        console.log("DB error:", err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
})


// POST route to save hardware events
app.post('/api/logs', async (req, res) => {
    const { data, UserID } = req.body; 
    try {
        // Ensure your tblLogs has these columns (LogID is usually AUTO_INCREMENT)
        const strQuery = "INSERT INTO tblLogs (UserID, RawData) VALUES (?, ?)";
        await pool.query(strQuery, [UserID, data]);
        
        console.log(`Log Saved: User ${UserID} - ${data}`);
        res.status(200).json({ status: "Success" });
    } catch (err) {
        console.error("Database Error (Logging):", err);
        res.status(500).json({ error: "Failed to save log" });
    }
});

// GET route to check for active calls and get the target UUID
app.get('/api/dispatch/status/:UnitID', async (req, res) => {
    const { UnitID } = req.params;
    try {
        const strQuery = `
            SELECT 
                a.ActiveCall, 
                u.ServiceUUID, 
                c.Needed -- This is your new column
            FROM tblAmbulance a
            LEFT JOIN tblUsers u ON a.UnitID = u.AssignedAmbulance
            LEFT JOIN tblCases c ON a.CaseID = c.CaseID 
            WHERE a.UnitID = ?`;
            
        const [rows] = await pool.query(strQuery, [UnitID]);
        
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({ error: "Unit not found" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// 
app.post('/api/dispatch/trigger', async (req, res) => {
    const { unitID, caseID, requiresNarcotics } = req.body;

    try {
        const sqlCaseID = parseInt(caseID);
        const neededValue = requiresNarcotics ? 1 : 0;

        console.log(`Executing SQL with: Case:${sqlCaseID}, Unit:${unitID}, Needed:${neededValue}`);

        const updateCase = "INSERT INTO tblCases (CaseID, ESPID, Locked, `Open`, Needed) VALUES (?, '0', 1, 0, ?) ON DUPLICATE KEY UPDATE Needed = ?, Locked = 1";
        await pool.query(updateCase, [sqlCaseID, neededValue, neededValue]);

        // Update the ambulance table to reflect an active call
        const strQuery = "UPDATE tblAmbulance SET ActiveCall = 1, CaseID = ? WHERE UnitID = ?";
        const [results] = await pool.query(strQuery, [caseID, unitID]);

        console.log("Rows affected in Ambulance:", results.affectedRows);
        console.log(`[Dispatch] Success: Unit ${unitID} assigned to Case ${caseID}.`);
        res.json({ success: true });
    } catch (err) {
        console.error("Update Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 
app.get('/api/hardware/status/:unitID', async (req, res) => {
    const { unitID } = req.params;
    try {
        const strQuery = `SELECT ActiveCall, Needed, Locked FROM tblAmbulance LEFT JOIN tblCases ON tblAmbulance.CaseID = tblCases.CaseID WHERE UnitID = ?`;
        const [rows] = await pool.query(strQuery, [unitID]);

        if(rows.length > 0) {
            res.json({
                active: rows[0].ActiveCall > 0,
                armNarcotics: rows[0].Needed == 1,
                isLocked: rows[0].Locked == 1
            });
        } else {
            res.status(404).json({ error: "Unit not assigned" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
})


app.get('/box', async (req, res) => {
    try {
        const [results] = await pool.query("SELECT * FROM tblCases");
        res.json(results)
    } catch(err) {
        console.error("Fetch Boxes Error:", err);
        res.status(500).json({error: err.message})
    }
})

app.get('/ambulance', async (req, res) => {
    try {
        const [results] = await pool.query("SELECT * FROM tblAmbulance");
        res.json(results)
    } catch(err) {
        console.error("Fetch Boxes Error:", err);
        res.status(500).json({error: err.message})
    }
})

// Audit box / changes "Needed" in tblCases
app.put('/case', async (req, res) => {
    const { caseID } = req.body.caseID

    try {
        let strQuery = "SELECT Needed FROM tblCases WHERE CaseID = ?"
        const [results] = await pool.query(strQuery, [caseID])

        let needed = results[0].Needed

        try {
            strQuery = "UPDATE tblCases SET Needed = ? WHERE CaseID = ?"
            [results] = await pool.query(strQuery, [!needed, caseID])
            res.json({ 
                status: success,
                results: results
            })
        } catch(err) {
            console.error("Server error:", err);
            res.status(500).json({ message: "Server error" });
        }

    } catch(err) {
        res.status(500).json({ error: err.message });
    }
})


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
