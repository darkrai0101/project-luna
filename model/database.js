var async = require('async');
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

function userLogin (name, value, email, type, callback){
    // type -- 
    // 1: gmail, 
    // 2: facebook

    var query = 'select * from users where ';
    if(type == 1) query += 'gmail = ?';
    else query += 'facebook = ?';
    var userID = 0;

    db.query( query, value, function(err, rows, fields){
        if(err) throw err;
        if(rows[0]){
            var row = rows[0];
            userID = row.id;

            //row.status === 0 ? callback(userID, 1) : callback(userID, 0);           
            callback(userID, 0);
            
        }else{
            var arr = {
                name : name,
                email : email,
                status : 1,
                type   : 1
            };

            switch(type){
                case 1:
                    arr.gmail = value;
                    break;
                case 2:
                    arr.facebook = value;  
                    break;
            } 
                
            db.query('insert into users set ?', arr, function(err, rows, fields){
                userID = rows.insertId;
                callback(userID, 1);
            });
        }
    });
};

function userSchedule(id){
    //lay danh sach lich nguoi dung
}
