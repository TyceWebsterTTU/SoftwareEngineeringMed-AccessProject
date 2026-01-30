// Required nodeJS applications
const express = require('express')
const mysql = require('mysql2/promise');
const {v4:uuidv4} = ('uuid')
const bcrypt = require('bcrypt')
const cors = require('cors');
const path = require('path');

// HTTP_PORT and activating express
const HTTPS_PORT = 3000
var app = express()



// This tells Node: "If someone visits the site, look for HTML files in the 'public' folder"
app.use(express.static(path.join(__dirname, 'public')));

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



// Proof of connection
app.listen(HTTPS_PORT, () => {
    console.log("Listening on port", HTTPS_PORT)
})

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

// Login Route
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const strQuery = "SELECT * FROM tblUsers WHERE Username = ?";
        const [results] = await pool.query(strQuery, [username]);

        if (results.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid username"
            });
        }

        const user = results[0];

        // Matching your current manual password check
        if (user.Password !== password) {
            return res.status(401).json({
                success: false,
                message: "Invalid password"
            });
        }

        res.json({
            success: true,
            userID: user.UserID,
            username: user.Username,
            isAdmin: user.Role === "Admin"
        });
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get All Users Route
app.get('/user', async (req, res) => {
    try {
        const [results] = await pool.query("SELECT * FROM tblUsers");
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