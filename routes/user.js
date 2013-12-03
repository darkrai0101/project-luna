
/*
 * user page
 */
var config = require('../config/config');

var amduonglich = require('../lib/amduonglich');
var mailer = require('../lib/mailer');
var func = require('../lib/func');
var database = require('../model/database');
var db = database.db;
var moment = require('moment');

exports.list = function(req, res){
  res.send("list user");
};

exports.quickCreate = function(req, res){
	var option = req.query;
	if(!option.email){
		//res.render('404', {url: req.url});
		//return;
		return res.send('1');
	}
	// var option = {
	// 	desc: 	'test',
 //    	hour: 	'2',
 //    	minute: '40',
 //    	period: 'pm',
 //    	date: 	'03',
 //    	month: 	'12',
 //    	repeat: '1',
 //    	email: 	'trungpheng@gmail.com'
	// };


	var email = option.email;
	if(option.period === 'pm') hour = parseInt(option.hour) + 12; else hour = option.hour;

	var solarDate;

	var now = new Date();
	if(option.repeat == 0){
		//repeat theo ngay
		var schedule_date = now.getDate();
		console.log(schedule_date);
		if(now.getHours() > hour){
			schedule_date += 1;
		}
		solarDate = func.toStringDate(now.getFullYear(), now.getMonth(), schedule_date, hour, option.minute);

	}else if(option.repeat == 1){
		//repeat theo thang
		var schedule = amduonglich.getNextSolarDateOfLunarDate(parseInt(option.date));
		
		var schedule_date = schedule[0];
		var schedule_month = schedule[1];
		var schedule_year = schedule[2];

		solarDate = func.toStringDate(schedule_year, schedule_month, schedule_date, hour, option.minute);
	}else{
		//repeat theo nam
		var schedule = amduonglich.getNextSolarDateOfLunarDateAndMonth(parseInt(option.date), parseInt(option.month));
		var schedule_date = schedule[0];
		var schedule_month = schedule[1];
		var schedule_year = schedule[2];

		solarDate = func.toStringDate(schedule_year, schedule_month, schedule_date, hour, option.minute);
	};
	
	console.log(solarDate);

	db.query('select id from users where email = ? limit 1', email, function(err, rows, fields){
		if(err) throw err;

		var token = func.createToken();
		var expire = func.createExpire();
		var userID;

		if(rows[0]){
			var row = rows[0];
			console.log(1);
			userID = row.id;

		}else{
			var arr = {
				name   : email,
				email  : email,
				status : 0
			};

			db.query('insert into users set ?', arr, function(err, rows, fields){
				if(err) throw err;
				userID = rows.insertId;
			});
		};

		var arr = {
			solarDate : solarDate, 
			userID 	  : userID,
			message   : option.decs,
	    	hour      : hour,
	    	minute    : option.minute,
	    	date      : option.date,
	    	month     : option.month,
	    	beforeHour: 0,
	    	repeatType: option.repeat,
	    	active    : 0
		};
		db.query('insert into calendar set ?', arr, function(err, rows, fields){
			if(err) throw err;

			var calendarID = rows.insertId;
			var arr = {
					userID     : userID,
					calendarID : calendarID,
					token      : token,
					expire     : expire
			};
			db.query('insert into token set ?', arr, function(err, rows, fields){
				if(err) throw err;
				mailer.auth(email, token);
				return res.send('1');
			});
		});
	});
};

exports.authToken = function(req, res){
	var token = req.params.token;
	if(!token){
		res.render('404', {url: req.url});
		return;
	};

	token = encodeURIComponent(token);

	db.query('select * from token where token = ? limit 1', token, function(err, rows, fiels){
		if(err) throw err;
		if(rows[0]){
			row = rows[0];
			var expire = row['expire'];
			var calendarID = row['calendarID'];
			var now = new Date().getTime();

			if(now < expire){
				var userID = row['userID'];
				db.query('update calendar set active = 1 where id = ?', calendarID);
				db.query('delete from token where token = ?', token);

				db.query('select email from users where id = ?', userID, function(err, rows, fields){
					if(err) throw err;
					if(rows[0]){
						mailer.thankReg(rows[0]['email']);

						return res.send('xac thuc thanh cong');
					}
				});
			}else{
				db.query('delete from calendar  where id = ?',calendarID);
				db.query('delete from token  where token = ?',token);

				res.send('ma xac thuc het han');
			}
		}else{
			res.render('404', {url: req.url});
			return;
		}
	});
};
