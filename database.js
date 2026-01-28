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
    port: 3306,
    password: "Password123",
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

// User get function
app.get('/user', (req, res, next) => {
    try {
        conHippoExchange.connect(err => {
            if (err) {
                console.error("Connection did not work because", err)
            } else {
                console.log("Success")
                let strQuery = "SELECT * FROM tblUser"
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
    let intUserID = req.body.userID
    let strUsername = req.body.username
    let strPassword = req.body.password
    let strRole = req.body.role
    let intAssignedAmbulance = req.body.assignedAmbulance

    try {
        conHippoExchange.connect(err => {
            if(err){
                console.log("Connection did not work because ", err)
            } else {
                console.log("Success")
                let strQuery = "INSERT INTO tblUsers VALUES (?,?,?,?,?)"
                conHippoExchange.query(strQuery, [intUserID, strUsername, strPassword, strRole, intAssignedAmbulance], (err, results, fields) => {
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