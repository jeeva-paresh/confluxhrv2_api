const mysql = require('mysql')
const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password:"",
    database: "liveconfluxv2"
})
connection.connect((err)=>{
if(err){
    console.error('Error in Connection',err)
    } else {
        console.log('Connection Successful')
    }
})

module.exports = connection;