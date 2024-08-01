require('dotenv').config();
const mysql = require('mysql')
const connection = mysql.createConnection({
    host: process.env.DB_HOSTNAME,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
})
connection.connect((err) => {
    if (err) {
        console.error('Error in Connection', err)
    } else {
        console.log('Connection Successful')
    }
})

module.exports = connection;

