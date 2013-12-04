
var config = require('./config/config');

/**
 * Module dependencies.
 */

var fs = require('fs');
var express = require('express');
var http = require('http');
var path = require('path');
var moment = require('moment');

/**
 * library
 */

var amduonglich = require('./lib/amduonglich');
var mailer = require('./lib/mailer');
var database = require('./model/database');
var db = database.db;
var func = require('./lib/func');

/**
 * Config Server
 */

var routes = require('./routes');
var user = require('./routes/user');

var app = module.exports = express();
var silent = 'test' == process.env.NODE_ENV;

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, '../Luna/dist'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.cookieParser());
app.use(express.bodyParser());
app.use(express.session({ secret: 'mininoic' }));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, '../Luna/dist')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

// custom verbose errors
app.enable('verbose errors');
// disable in production
if('production' == app.settings.env){
	app.disable('verbose errors');
}

silent || app.use(express.logger('dev'));

app.use(function(req, res, next){
	res.status(404);

	if(req.accepts('html')){
		res.render('404', {url: req.url});
		return;
	}
});

app.use(function(err, req, res, next){

	res.status(err.status || 500);
	res.render('500', {error: err});

});

/**
 * MAIN
 */

// scheduling

setInterval(function(){

  var now = moment().zone("+07:00");
  var now_string = moment(now).format('YYYY-MM-DD');
  var now_hour = now.hours();
  var now_minute = now.minutes();

  db.query('select * from calendar where active = 1', function(err, rows, fields){
    if(err) throw err;
    for(var p in rows){
      var row = rows[p];
      
      var date = moment(row.solarDate);
      var date_string = date.format('YYYY-MM-DD');
      console.log(date_string +' -- '+now_string);
      if(date_string === now_string){
        var hour = date.hours();
        if(now_hour === hour){
          var minute = date.minutes();
          if(now_minute < minute + 5 && now_minute > minute - 5){
            console.log('alarm alarm');

            var repeatType = row.repeatType;
            var solarDate = new Date();
            
            if(repeatType == 0){
              // update lai ngay: ngay + 1
              var day = solarDate.getDate() + 1;
              solarDate.setDate(day);

              console.log(solarDate);
            }else if(repeatType == 1){
              // update lai ngay moi cua thang sau
              var nextDate = amduonglich.getNextSolarDateOfLunarDate(parseInt(row.date));
              console.log(nextDate);
              solarDate.setDate(nextDate[0]);
              solarDate.setMonth(nextDate[1]-1);
              solarDate.setFullYear(nextDate[2]);

            }else{
              // update lai ngay thang moi nam sau
              var nextDateMonth = amduonglich.getNextSolarDateOfLunarDateAndMonth(parseInt(row.date), parseInt(row.month));
              solarDate.setDate(nextDate[0]);
              solarDate.setMonth(nextDate[1]-1);
              solarDate.setFullYear(nextDate[2]);
            }
            console.log(solarDate);
            var solarDateString = func.toStringDate(solarDate.getFullYear(), solarDate.getMonth()+1, solarDate.getDate(), row.hour, row.minute);
            console.log('string - '+solarDateString);
            db.query('update calendar set solarDate = "'+solarDateString+'" where id = ?',row.id);

            db.query('select email from users where id = ? limit 1', row.userID, function(err, rows, fields){
                mailer.noti(rows[0]['email'], row.message);
            });
          }
        }
      }
    }
  });
}, 6000);


 // ROUTES

app.get('/', routes.index);
// app.get('/user', user.list);
// app.get('/user/quick-create', user.quickCreate);
// app.get('/user/auth-token/:token', user.authToken);
app.all('/user', function(req, res, next){
  return res.send('test');
});
app.all('/user/quick-create', function(req, res, next){
  var option = req.body;
  //console.log(req);
  //console.log(option);
  if(!option.email){
    res.render('404', {url: req.url});
    return;
  }
  // var option = {
  //  desc:   'test',
 //     hour:   '2',
 //     minute: '40',
 //     period: 'pm',
 //     date:   '03',
 //     month:  '12',
 //     repeat: '1',
 //     email:  'trungpheng@gmail.com'
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
  var arr_calendar = {
        solarDate : solarDate, 
        userID    : '',
        message   : option.decs,
        hour      : hour,
        minute    : option.minute,
        date      : option.date,
        month     : option.month,
        beforeHour: 0,
        repeatType: option.repeat,
        active    : 0
    };

  db.query('select id from users where email = ? limit 1', email, function(err, rows, fields){
    if(err) throw err;

    var token = func.createToken();
    var expire = func.createExpire();
    var userID;

    if(rows[0]){
      var row = rows[0];
      console.log(1);
      userID = row.id;

      arr_calendar.userID = userID;
    }else{
      var arr = {
        name   : email,
        email  : email,
        status : 0
      };

      db.query('insert into users set ?', arr, function(err, rows, fields){
        if(err) throw err;
        userID = rows.insertId;

        arr_calendar.userID = userID;
      });
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
});
app.all('/user/auth-token/:token', function(req, res, next){
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
});


app.get('/404', function(req, res, next){
  // trigger a 404 since no other middleware
  // will match /404 after this one, and we're not
  // responding here
  next();
});

app.get('/403', function(req, res, next){
  // trigger a 403 error
  var err = new Error('not allowed!');
  err.status = 403;
  next(err);
});

app.get('/500', function(req, res, next){
  // trigger a generic (500) error
  next(new Error('keyboard cat!'));
});

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));

  fs.writeFile(__dirname + '/start.log', 'started');
});

