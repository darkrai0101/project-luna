
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
app.set('views', path.join(__dirname, 'views'));
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
app.use(express.static(path.join(__dirname, 'public')));

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
app.get('/user', user.list);
app.get('/user/quick-create', user.quickCreate);
app.get('/user/auth-token/:token', user.authToken);


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

