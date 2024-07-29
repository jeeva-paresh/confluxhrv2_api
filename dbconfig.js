const mysql = require('mysql')
const connection = mysql.createConnection({
    host: "confluxhr.cwsjkiciisk1.us-east-2.rds.amazonaws.com",
    user: "adminconfluxhr",
    password:"Hr2025#$confluxhr",
    database: "CL_hrms"
})
connection.connect((err)=>{
if(err){
    console.error('Error in Connection',err)
    } else {
        console.log('Connection Successful')
    }
})

module.exports = connection;
