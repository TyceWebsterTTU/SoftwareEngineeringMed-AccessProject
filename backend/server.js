const mysql = require('mysql2');

const connection = mysql.createConnection({
  // Use 'db' because that is the service name in docker-compose
  host: process.env.DB_HOST || 'db', 
  user: process.env.DB_USER || 'user',
  password: process.env.DB_PASS || 'userpassword123',
  database: process.env.DB_NAME || 'capstonedb'
});