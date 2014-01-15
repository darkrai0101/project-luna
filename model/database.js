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
exports.addAccount = addAccount;

function addAccount(value, userID ,check, type, callback){
    // type -- 
    // 1: them tai khoan gmail, 
    // 2: them tai khoan facebook
    
    var oldID;

    var query = '';
            if(type == 1) query = 'update users set gmail = ? where id = ?';
            else query = 'update users set facebook = ? where id = ?';

            db.query(query, [value, userID], function(err, rows, fields){
                if(err) throw err;
                if(rows.affectedRows){
                    var query1 = '';
                    if(type == 1) query1 = 'select id from users where gmail = ? limit 1';
                    else query1 = 'select id from users where facebook = ? limit 1';

                    db.query(query1, check, function(err, rows, fields){
                        if(err) throw err;
                        if(rows[0]){
                            var oldID = rows[0].id;
                            db.query('delete from users where id = ?', oldID, function(err, rows, fields){
                                    if(err) throw err;
                                    console.log('test oldID'+oldID);
                                    db.query('update set userID = ? where userID = ?',[userID, oldID], function(err, rows, fields){
                                        if(err) throw err;
                                        if(rows.affectedRows){
                                            console.log(rows.affectedRows);
                                            callback(null, userID);
                                        }else{
                                            console.log('no calendar row update');
                                            callback(null, 'no calendar row update');
                                        }
                                    });
                            });
                        }else{
                            callback(null, 'no oldID select');
                        }
                    });
                }else{
                    callback('error: update value', null);
                }
            });

    // async.series([
    //     function(cb){
    //         var query = '';
    //         if(type == 1) query = 'update users set gmail = ? where id = ?';
    //         else query = 'update users set facebook = ? where id = ?';

    //         db.query(query, [value, userID], function(err, rows, fields){
    //             if(err) throw err;
    //             if(rows.affectedRows){
    //                 cb();
    //             }else{
    //                 callback('error: update value', null);
    //             }
    //         });
    //     },
    //     function(cb){
    //         var query1 = '';
    //         if(type == 1) query1 = 'select id from users where gmail = ? limit 1';
    //         else query1 = 'select id from users where facebook = ? limit 1';

    //         db.query(query1, check, function(err, rows, fields){
    //             if(err) throw err;
    //             if(rows[0]){
    //                 var oldID = rows[0].id;
    //                 db,query('delete from users where id = ?', oldID, function(err, rows, fields){
    //                         if(err) throw err;
    //                         cb();
    //                 });
    //             }else{
    //                 callback(null, 'no oldID select');
    //             }
    //         });
    //     },
    //     function(cb){
    //         console.log('test oldID'+oldID);
    //         db.query('update set userID = ? where userID = ?',[userID, oldID], function(err, rows, fields){
    //             if(err) throw err;
    //             if(rows.affectedRows){
    //                 console.log(rows.affectedRows);
    //                 callback(null, userID);
    //             }else{
    //                 console.log('no calendar row update');
    //                 callback(null, 'no calendar row update');
    //             }
    //         });
    //     },
    // ]);
}

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
}

function userSchedule(id){
    //lay danh sach lich nguoi dung
}
