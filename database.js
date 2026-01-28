// Required nodeJS applications
const express = require('express')
const mysql = require('mysql2')
const {v4:uuidv4} = require('uuid')
const bcrypt = require('bcrypt')
const cors = require('cors');

// HTTP_PORT and activating express
const HTTP_PORT = 8000
var app = express()
app.use(express.json())
//Activating cors
app.use(cors());

// Connection Data for the database
const objConnectionData = {
    host: 'localhost',
    user: 'root',
    port: 3305,
    password: "Mickey2025!",
    database: "dbMedAccess"
}
const conMedAccess = mysql.createConnection(objConnectionData)

// Proof of connection
app.listen(HTTP_PORT, () => {
    console.log("Listening on port", HTTP_PORT)
})

// Test
app.get('/test',(req,res,next) => {
    try {
        conMedAccess.connect(err => {
            if (err) {
                console.error("Connection did not work because", err)
            } else {
                console.log("Success")
                let strQuery = "SELECT * FROM test"
                conMedAccess.query(strQuery, (err, results, fields) => {
                    if(err){
                        console.error('Error again', err)
                        res.status(404).json(err)
                    } else {
                        console.log(results)
                        res.status(200).json({results: results})
                    }
                })    
            }
        })
    } catch (err) {
        res.status(401).json({ error: err })
    }
})

app.post('/login', (req, res, next) => {
    let strUsername = req.body.username;
    let strPassword = req.body.password;

    try {
        conMedAccess.connect (err => {
            if (err) {
                console.error("Connection did not work because", err);
            } else {
                console.log("Success");
                let strQuery = "SELECT * FROM tblUsers WHERE Username = ?";
                conMedAccess.query(strQuery, [strUsername], (err, results, fields) => {
                    if (err) {
                        console.error(err);
                        return res.status(404).json({ success: false});
                    }

                    if (results.length === 0) {
                        console.log(results);
                        return res.status(401).json({
                            success: false,
                            message: "Invalid username or password"
                        });
                    }

                    const user = results[0];
                    console.log(user)

                    // const passwordMatch = passwordMatch = bcrypt.compareSync(
                    //     strPassword,
                    //     user.password
                    // );

                    // if (!passwordMatch) {
                    //     return res.status(401).json({
                    //         success: false,
                    //         message: "Invalid password"
                    //     })
                    // }

                    if(user.Password != strPassword) {
                        return res.status(401).json({
                            success: false,
                            message: "Invalid password"
                        })
                    }

                    res.json({
                        success: true,
                        userID: user.UserID,
                        username: user.Username,
                        isAdmin: user.Role == "Admin"
                    });
                })
            }
        })
    } catch (err) {
        res.status(401).json({ error: err });
    }
})

// User get function
app.get('/user', (req, res, next) => {
    try {
        conMedAccess.connect(err => {
            if (err) {
                console.error("Connection did not work because", err)
            } else {
                console.log("Success")
                let strQuery = "SELECT * FROM tblUsers"
                conMedAccess.query(strQuery, (err, results, fields) => {
                    if(err) {
                        console.error("Error: ", err)
                        res.status(404).json(err)
                    } else {
                        console.log(results)
                        return res.json(results)
                    }
                })
            }
        })
    } catch (err) {
        res.status(401).json({ error: err })
    }
})

// User post function
app.post('/user', (req, res, next) => {
    let intUserID = req.body.userID;
    let strUsername = req.body.username;
    let strPassword = req.body.password;
    let strRole = req.body.role;
    let intAssignedAmbulance = req.body.assignedAmbulance;

    try {
        conMedAccess.connect(err => {
            if(err){
                console.log("Connection did not work because ", err)
            } else {
                console.log("Success")
                let strQuery = "INSERT INTO tblUsers VALUES (?,?,?,?,?)"
                conMedAccess.query(strQuery, [intUserID, strUsername, strPassword, strRole, intAssignedAmbulance], (err, results, fields) => {
                    if(err) {
                        console.error('Error again', err)
                        res.status(404).json({status:"Failed"})
                    } else {
                        console.log(results)
                        res.status(200).json({status:"Success"})
                    }
                })
            }
        })
    } catch(err) {
        res.status(401).json({error:err})
    }
})