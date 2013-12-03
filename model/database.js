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