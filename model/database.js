var mysql = require('mysql');
var config = require('../config/config');

var config_db = config.mysql;

var db = mysql.createConnection({
  host: config_db.host,
  port: config_db.port,
  user: config_db.user,
  password: config_db.password,
  database: config_db.database,
});

exports.db = db;
exports.userLogin = userLogin;
exports.userSchedule = userSchedule;

function userLogin (name, value, type){
    //type 1: gmail, 2: facebook
    var query = 'select * from users where ';
    if(type == 1) query += 'gmail = ?';
    else query += 'facebook = ?'
    db.query( query, value, function(err, rows, fields){
        if(err) throw err;
        var userID;
        if(rows[0]){
            var row = rows[0];
            userID = row.id;
        }else{
            var arr = {
                name : name,
                gmail : '',
                facebook : '',
                email : '',
                status : 0
            };

            if(type == 1){ 
                arr.gmail = value;
                arr.email = value;
            }
            else
                arr.facebook = value;

            db.query('insert into users set ?', arr, function(err, rows, fields){
                userID = insertId;
            });
        }
        return userID;
    });
};

function userSchedule(id){
    //lay danh sach lich nguoi dung
}
