
var config = require('./config/config');

/**
 * Module dependencies.
 */

var fs = require('fs');
var express = require('express');
var http = require('http');
var path = require('path');
var moment = require('moment');
var util = require('util');
var async = require('async');

/**
 * LOGIN OPENID
 */

var passport = require('passport');
var GoogleStrategy = require('passport-google').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

passport.use(new GoogleStrategy({
    returnURL: config.constant.url+'/auth/google/return',
    realm: config.constant.url
  },
  function(identifier, profile, done) {
    process.nextTick(function () {
      profile.identifier = identifier;
      return done(null, profile);
    });
  }
));

passport.use(new FacebookStrategy({
    clientID: config.fb.appId,
    clientSecret: config.fb.appSecret,
    callbackURL: config.constant.url+"/auth/facebook/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    process.nextTick(function () {
      return done(null, profile);
    });
  }
));

/**
 * library
 */

var amduonglich = require('./lib/amduonglich');
var mailer = require('./lib/mailer');
var database = require('./model/database');
var db = database.db;
var func = require('./lib/func');
var facebook = require('./lib/facebook');

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
app.use(passport.initialize());
app.use(passport.session());
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
  db.query('select * from calendar where active = 1 and status = 1', function(err, rows, fields){
    if(err) throw err;
    if(rows[0]){
      for(var p = 0; p < rows.length; p++){
        schedule(rows[p]);
      }
    }else{
      console.log('Khong co nhac nho nao...');
    }
  });

  //repeat mail error
  db.query('select * from mail_error', function(err, rows, fields){
    if(err) throw err;
    if(rows[0]){
      for(var q = 0; q < rows.length; q++){
        mailErr(rows[q]);
      }
    }else{
      console.log('Khong co mail gui loi...');
    }
  });
  console.log('scheduling...');
}, 40000);


 // ROUTES

app.get('/', routes.index);
// app.all('/user', user.list);
// app.get('/user/quick-create', user.quickCreate);
// app.get('/user/auth-token/:token', user.authToken);
app.all('/user', function(req, res, next){
  return res.send('test');
});

/**
 * routes: quick-create
 */
app.all('/user/quick-create', function(req, res, next){
  var option = req.body;
  if(!option.email){
    res.render('404', {url: req.url});
    return;
  }
  console.log(option);
  var email = option.email;
  option.period === 'pm' ? hour = parseInt(option.hour) + 12 : hour = option.hour;

  var solarDate;

  var now = new Date();
  if(option.repeat == 0){
    //repeat theo ngay
    var schedule_date = now.getDate();
    if(now.getHours() > hour){
      schedule_date += 1;
    }
    solarDate = func.toStringDate(now.getFullYear(), now.getMonth()+1, schedule_date, hour, option.minute);

  }else if(option.repeat == 1){
    //repeat theo thang
    var schedule = amduonglich.getNextSolarDateOfLunarDate(parseInt(option.minute), parseInt(hour), parseInt(option.date));
    solarDate = func.toStringDate(schedule[0], schedule[1], schedule[2], hour, option.minute);
  }else{
    //repeat theo nam
    var schedule = amduonglich.getNextSolarDateOfLunarDateAndMonth(parseInt(option.minute), parseInt(hour), parseInt(option.date), parseInt(option.month));
    solarDate = func.toStringDate(schedule[0], schedule[1], schedule[2], hour, option.minute);
  };

  solarDate = new Date(solarDate);

  //check pre
  option.pre_kind.index == 0 ? solarDate.setHours(solarDate.getHours() + parseInt(option.pre)) : solarDate.setDate(solarDate.getDate() + parseInt(option.pre));

  var arr_calendar = {
        userID    : '',
        uuid      : option.udid,
        solarDate : solarDate, 
        message   : option.desc,
        hour      : hour,
        minute    : option.minute,
        date      : option.date,
        month     : option.month,
        repeatType: option.repeat,
        pre       : option.pre,
        pre_kind  : option.pre_kind.index,
        active    : 0,
        status    : 1,
        createTime : now,
    };

  db.query('select id from users where email = ? and type = 0 limit 1', email, function(err, rows, fields){
    if(err) throw err;

    console.log('user-quick-create: get record from users...');

    var token = func.createToken();
    var expire = func.createExpire();
    var userID;

    
    if(rows[0]){
      console.log('user-quick-create: exists record...');
      var row = rows[0];
      userID = row.id;

      arr_calendar.userID = userID;

      db.query('insert into calendar set ?', arr_calendar, function(err, rows, fields){
          if(err) throw err;

          var calendarID = rows.insertId;
          console.log('user-quick-create: insert record into calendar: '+calendarID);

          var arr = {
              userID     : userID,
              calendarID : calendarID,
              token      : token,
              expire     : expire
          };
          db.query('insert into token set ?', arr, function(err, rows, fields){
            if(err) throw err;
            console.log('user-quick-create: insert record into token: '+rows.insertId);
            var time;
            switch(arr_calendar.repeatType){
              case 0:
                time = 'Vào '+arr_calendar.hour+' giờ '+(arr_calendar.minute < 0 ? '0':'') + arr_calendar.minute +' phút hàng ngày';break;
              case 1:
                time = 'Vào '+arr_calendar.hour+' giờ '+(arr_calendar.minute < 0 ? '0':'') + arr_calendar.minute +' phút ngày '+(arr_calendar.date == 100 ? 'cuối' : arr_calendar.date)+' hàng tháng';break;
              case 2:
                time = 'Vào '+arr_calendar.hour+' giờ '+(arr_calendar.minute < 0 ? '0':'') + arr_calendar.minute +' phút ngày '+(arr_calendar.date == 100 ? 'cuối' : arr_calendar.date)+' tháng '+arr_calendar.month+' hàng năm';break;
            };

            console.log('user-quick-create: mailing... '+email+' - '+token+' - '+arr_calendar.message+' - '+time);
            mailer.auth(email, token, arr_calendar.message, time);
            return res.send('1');
          });
        });

    }else{
      console.log('user-quick-create: NOT exists record...');
      var arr = {
        name   : email,
        email  : email,
        status : 0,
        type   : 0,
      };

      db.query('insert into users set ?', arr, function(err, rows, fields){
        if(err) throw err;
        userID = rows.insertId;

        console.log('user-quick-create: insert record into users: '+userID);

        arr_calendar.userID = userID;

        db.query('insert into calendar set ?', arr_calendar, function(err, rows, fields){
          if(err) throw err;

          var calendarID = rows.insertId;
          console.log('user-quick-create: insert record into calendar: '+calendarID);

          var arr = {
              userID     : userID,
              calendarID : calendarID,
              token      : token,
              expire     : expire
          };
          db.query('insert into token set ?', arr, function(err, rows, fields){
            if(err) throw err;
            console.log('user-quick-create: insert record into token: '+rows.insertId);
            var time;
            switch(arr_calendar.repeatType){
              case 0:
                time = 'Vào '+arr_calendar.hour+' giờ '+(arr_calendar.minute < 0 ? '0':'') + arr_calendar.minute +' phút hàng ngày';break;
              case 1:
                time = 'Vào '+arr_calendar.hour+' giờ '+(arr_calendar.minute < 0 ? '0':'') + arr_calendar.minute +' phút ngày '+(arr_calendar.date == 100 ? 'cuối' : arr_calendar.date)+' hàng tháng';break;
              case 2:
                time = 'Vào '+arr_calendar.hour+' giờ '+(arr_calendar.minute < 0 ? '0':'') + arr_calendar.minute +' phút ngày '+(arr_calendar.date == 100 ? 'cuối' : arr_calendar.date)+' tháng '+arr_calendar.month+' hàng năm';break;
            };

            console.log('user-quick-create: mailing... '+email+' - '+token+' - '+arr_calendar.message+' - '+time);
            mailer.auth(email, token, arr_calendar.message, time);
            return res.send('1');
          });
        });
      });
    };
  });
});

app.all('/user/try-create', function(req, res, next){
  var option = req.body;
  if(!option.email){
    res.render('404', {url: req.url});
    return;
  }

  var email = option.email;
  var uuid = option.udid;
  db.query('select * from calendar where uuid = "'+uuid+'" limit 1', function(err, rows, fields){
    if(err) throw err;

    console.log('user-try-create: get record form calendar...');
    if(rows[0]){
      console.log('user-try-create: exists record...');
      //neu co roi thi gui lai mail
      var token = func.createToken();
      var expire = func.createExpire();
      var row = rows[0];
          var arr = {
              userID     : row.userID,
              calendarID : row.id,
              token      : token,
              expire     : expire
          };
          db.query('insert into token set ?', arr, function(err, rows, fields){
            if(err) throw err;
            console.log('user-try-create: insert into token: '+rows.insertId);

            var time = '';
            switch(row.repeatType){
              case 0:
                time = 'Vào '+row.hour+' giờ '+(row.minute < 10 ? '0':'') + row.minute +' phút hàng ngày';break;
              case 1:
                time = 'Vào '+row.hour+' giờ '+(row.minute < 10 ? '0':'') + row.minute +' phút ngày '+(row.date == 100 ? 'cuối' : row.date)+' hàng tháng';break;
              case 2:
                time = 'Vào '+row.hour+' giờ '+(row.minute < 10 ? '0':'') + row.minute +' phút ngày '+(row.date == 100 ? 'cuối' : row.date)+' tháng '+row.month+' hàng năm';break;
            };
            console.log('user-try-create: mailing... '+email+' - '+token+' - '+row.message+' - '+time);
            mailer.auth(email, token, row.message, time);
            return res.send('1');
          });
    }else{
      console.log('user-try-create: NOT exists record...');
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
        solarDate = func.toStringDate(now.getFullYear(), now.getMonth()+1, schedule_date, hour, option.minute);

      }else if(option.repeat == 1){
        //repeat theo thang
        var schedule = amduonglich.getNextSolarDateOfLunarDate(parseInt(option.minute), parseInt(hour), parseInt(option.date));
        
        var schedule_date = schedule[0];
        var schedule_month = schedule[1];
        var schedule_year = schedule[2];

        solarDate = func.toStringDate(schedule_year, schedule_month, schedule_date, hour, option.minute);
      }else{
        //repeat theo nam
        var schedule = amduonglich.getNextSolarDateOfLunarDateAndMonth(parseInt(option.minute), parseInt(hour), parseInt(option.date), parseInt(option.month));
        console.log(schedule);

        var schedule_date = schedule[0];
        var schedule_month = schedule[1];
        var schedule_year = schedule[2];

        solarDate = func.toStringDate(schedule_year, schedule_month, schedule_date, hour, option.minute);
      };
      
      //check pre
      option.pre_kind.index == 0 ? solarDate.setHours(solarDate.getHours() + parseInt(option.pre)) : solarDate.setDate(solarDate.getDate() + parseInt(option.pre));

      var arr_calendar = {
        userID    : '',
        uuid      : option.udid,
        solarDate : solarDate, 
        message   : option.desc,
        hour      : hour,
        minute    : option.minute,
        date      : option.date,
        month     : option.month,
        repeatType: option.repeat,
        pre       : option.pre,
        pre_kind  : option.pre_kind.index,
        active    : 0,
        status    : 1,
        createTime : now,
      };

      db.query('select id from users where email = ? limit 1', email, function(err, rows, fields){
        if(err) throw err;
        console.log('user-try-create: checking exists email...');
        var token = func.createToken();
        var expire = func.createExpire();
        var userID;

        
        if(rows[0]){
          console.log('user-try-create: exists record...');
          var row = rows[0];
          console.log(1);
          userID = row.id;

          arr_calendar.userID = userID;

          db.query('insert into calendar set ?', arr_calendar, function(err, rows, fields){
              if(err) throw err;
              console.log('user-try-create: insert into calendar: '+rows.insertId);
              var calendarID = rows.insertId;
              var arr = {
                  userID     : userID,
                  calendarID : calendarID,
                  token      : token,
                  expire     : expire
              };
              db.query('insert into token set ?', arr, function(err, rows, fields){
                if(err) throw err;
                console.log('user-try-create: insert into token: '+rows.insertId);
                var time;
                switch(arr_calendar.repeatType){
                  case 0:
                    time = 'Vào '+arr_calendar.hour+' giờ '+(arr_calendar.minute < 0 ? '0':'') + arr_calendar.minute +' phút hàng ngày';break;
                  case 1:
                    time = 'Vào '+arr_calendar.hour+' giờ '+(arr_calendar.minute < 0 ? '0':'') + arr_calendar.minute +' phút ngày '+(arr_calendar.date == 100 ? 'cuối' : arr_calendar.date)+' hàng tháng';break;
                  case 2:
                    time = 'Vào '+arr_calendar.hour+' giờ '+(arr_calendar.minute < 0 ? '0':'') + arr_calendar.minute +' phút ngày '+(arr_calendar.date == 100 ? 'cuối' : arr_calendar.date)+' tháng '+arr_calendar.month+' hàng năm';break;
                };

                console.log('user-try-create: mailing... '+email+' - '+token+' - '+arr_calendar.message+' - '+time);
                mailer.auth(email, token, arr_calendar.message, time);
                return res.send('1');
              });
            });

        }else{

          console.log('user-try-create: NOT exists record...');
          var arr = {
            name   : email,
            email  : email,
            status : 0
          };

          db.query('insert into users set ?', arr, function(err, rows, fields){
            if(err) throw err;
            console.log('user-try-create: insert into users: '+rows.insertId);
            userID = rows.insertId;

            arr_calendar.userID = userID;

            db.query('insert into calendar set ?', arr_calendar, function(err, rows, fields){
              if(err) throw err;
              console.log('user-try-create: insert into calendar: '+rows.insertId);
              var calendarID = rows.insertId;
              var arr = {
                  userID     : userID,
                  calendarID : calendarID,
                  token      : token,
                  expire     : expire
              };
              db.query('insert into token set ?', arr, function(err, rows, fields){
                if(err) throw err;
                console.log('user-try-create: insert into token: '+rows.insertId);
                var time;
                switch(arr_calendar.repeatType){
                  case 0:
                    time = 'Vào '+arr_calendar.hour+' giờ '+(arr_calendar.minute < 0 ? '0':'') + arr_calendar.minute +' phút hàng ngày';break;
                  case 1:
                    time = 'Vào '+arr_calendar.hour+' giờ '+(arr_calendar.minute < 0 ? '0':'') + arr_calendar.minute +' phút ngày '+(arr_calendar.date == 100 ? 'cuối' : arr_calendar.date)+' hàng tháng';break;
                  case 2:
                    time = 'Vào '+arr_calendar.hour+' giờ '+(arr_calendar.minute < 0 ? '0':'') + arr_calendar.minute +' phút ngày '+(arr_calendar.date == 100 ? 'cuối' : arr_calendar.date)+' tháng '+arr_calendar.month+' hàng năm';break;
                };

                console.log('user-try-create: mailing... '+email+' - '+token+' - '+arr_calendar.message+' - '+time);
                mailer.auth(email, token, arr_calendar.message, time);
                return res.send('1');
              });
            });
          });
        };
      });
    };
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
    console.log('user-auth-token: get record from token...');
    if(rows[0]){
      row = rows[0];
      var expire = row['expire'];
      var calendarID = row['calendarID'];
      var now = new Date().getTime();

      if(now < expire){
        console.log('user-auth-token: token in expire...');
        var userID = row['userID'];
        db.query('update calendar set active = 1 where id = ?', calendarID, function(err, rows, fields){
          if(err) throw err;
          console.log('user-auth-token: update calendar is active: '+calendarID);
        });
        db.query('delete from token where token = ?', token, function(err, rows, fields){
          if(err) throw err;
          console.log('user-auth-token: delete record in token: '+token);
        });

        db.query('select email from users where id = ?', userID, function(err, rows, fields){
          if(err) throw err;
          if(rows[0]){
            console.log('user-auth-token: get email form users...');

            console.log('user-auth-token: mailing... '+rows[0]['email']);

            db.query('update users set status = 2 where id = ?', userID, function(err, rows, fields){
              if(err) throw err;
              console.log('user-auth-token: update status = 2 where id= '+userID);
            });

            mailer.thankReg(rows[0]['email']);
            //return res.send('xac thuc thanh cong');
            return res.redirect('/#/has/created')
          }
        });
      }else{
        console.log('user-auth-token: token out of expire...');

        db.query('delete from calendar  where id = ?',calendarID, function(err, rows, fields){
          if(err) throw err;
          console.log('user-auth-token: delete record calendar: '+calendarID);
        });

        db.query('delete from token  where token = ?',token, function(err, rows, fields){
          if(err) throw err;
          console.log('user-auth-token: delete record from token: '+token);
        });

        //res.send('ma xac thuc het han');
        return res.redirect('/auth-fail-create');
      }
    }else{
      //res.render('404', {url: req.url});
      //return;
      return res.redirect('/#/has/auth-fail-create');
    }
  });
});

app.all('/user/delete-event/:email', function(req, res, next){
  var email = req.params.email;
  console.log(email);
  if(!email){
    res.render('404', {url: req.url});
    return;
  }

  db.query('select * from users left join calendar on users.id = calendar.userID where users.email = "'+email+'" and calendar.active = 1', function(err, rows, fields){
    if(err) throw err;

    console.log('user-delete-event: get record from users join calendar...');
    if(rows[0]){

      console.log('user-delete-event: exists record...');
      var option = [];
      var time = '';
      var expire = func.createExpire();

      for(var p in rows){
        var row = rows[p];

        switch(row.repeatType){
          case 0:
            time = 'Vào '+row.hour+' giờ '+(row.minute < 10 ? '0':'') + row.minute +' phút hàng ngày';break;
          case 1:
            time = 'Vào '+row.hour+' giờ '+(row.minute < 10 ? '0':'') + row.minute +' phút ngày '+(row.date == 100 ? 'cuối' : row.date)+' hàng tháng';break;
          case 2:
            time = 'Vào '+row.hour+' giờ '+(row.minute < 10 ? '0':'') + row.minute +' phút ngày '+(row.date == 100 ? 'cuối' : row.date)+' tháng '+row.month+' hàng năm';break;
        };

        var message = row.message;
        var token = func.createToken();
        var link = config.constant.url+'/user/auth/delete-event/'+token;
        option.push({
            time : time,
            message: message,
            link : link
        });

        var arr = {
          userID : row.userID,
          calendarID: row.id,
          token : token,
          expire: expire
        };

        db.query('insert into token set ?', arr, function(err, rows, fields){
          if(err) throw err;
          console.log('user-delete-event: insert record into token: '+rows.insertId);
        });
      }
      console.log('user-delete-event: mailing... '+email+' - '+JSON.stringify(option));
      mailer.deleteEvent(email, option);
      return res.send('1');
    }else{
      console.log('user-delete-event: not exists record...');
      return res.send('0');
    }
  });
});

app.all('/user/auth/delete-event/:token', function(req, res, next){
  var token = req.params.token;
  if(!token){
    res.render('404', {url: req.url});
    return;
  }
  token = encodeURIComponent(token);

  db.query('select * from token where token = ? limit 1', token, function(err, rows, fields){
      if(err) throw err;

      console.log('auth-delete-event: checking token...');
      if(rows[0]){
        row = rows[0];
        var expire = row['expire'];
        var calendarID = row['calendarID'];
        var now = new Date().getTime();

        if(now < expire){
          console.log('auth-delete-event: time in expire...');

          db.query('delete from calendar where id = ?', calendarID, function(err, rows, fields){
            if(err) throw err;
            console.log('auth-delete-event: delete record in calendar: '+calendarID);
          });
          db.query('delete from token where token = ?', token, function(err, rows, fields){
            if(err) throw err;
            console.log('auth-delete-event: delete rerord in token: '+token);
          });

          //return res.send('xac thuc thanh cong');
          return res.redirect('/#/has/deleted');
        }else{

          console.log('auth-delete-event: token out of expire');

          db.query('delete from token  where token = ?',token, function(err, rows, fields){
            if(err) throw err;
            console.log('auth-delete-event: delete record in token: '+token);
          });
          //return res.send('ma xac thuc het han');
          return res.redirect('/#/has/auth-fail-delete');
        }
      }else{

        //res.render('404', {url: req.url});
        //return;
        return res.redirect('/#/has/auth-fail-delete');
      }
  });
});

/*
 * routes: account
 */

app.get('/account', ensureAuthenticated, function(req, res){
  return res.json(req.user);
});

/*
 * routes: event-list
 * lay danh sach tat ca cac event cua account hien tai
 */
app.get('/account/event-list', ensureAuthenticated, function(req, res){
  res.setHeader('Content-Type', 'text/plain');
  var userID = req.user.userID;
  db.query('select email from users where id = ?', userID, function(err, rows, fields){
    if(err) throw err;
    if(rows[0]){
      var email = rows[0].email;
      //var email = 'trungpheng@gmail.com';
      var query = 'SELECT calendar.id, calendar.message, calendar.status, calendar.hour, calendar.minute, calendar.date, calendar.month, calendar.repeatType, calendar.pre, calendar.pre_kind from calendar'
                  +' join (select id from users where email = ? and users.status != 0 or id = ?)as xx'
                  +' on xx.id = calendar.userID'
                  +' and calendar.active = 1';

      db.query(query,[email, userID], function(err, rows, fields){
        if(err) throw err;
        if(rows[0]){
          return res.json(func.sortEvents(rows));
        }else{
          return res.json();
        }
      });
    }
  });
});

/*
 * routes: delete-event
 * input: params: id -- calendarID
 * Xoa su kien co id. cua nguoi dung hien tai
 */
app.all('/account/delete-event', ensureAuthenticated, function(req, res){
  res.setHeader('Content-Type', 'text/plain');
  var userID = req.user.userID;

  var listID = req.body;
  listID = listID.join(); 
  console.log('delete-event: '+listID);

  db.query('delete from calendar where id in ('+listID+')', function(err, rows, fields){
    if(err) throw err;
    if(rows.affectedRows != 0){
      console.log(rows);
      return res.json(1);
    }else{
      return res.json(0);
    } 
  });
});

/*
 * routes: delete-event
 * input: params: id -- calendarID, status
 * thay doi trang thai bat - tat cua su kien co id.
 */
app.get('/account/status-event/:id/:status', ensureAuthenticated, function(req, res){
  res.setHeader('Content-Type', 'text/plain');

  var userID = req.user.userID;
  var calendarID = req.params.id;
  var status = req.params.status;

  if(status == 1){
    db.query('select * from calendar where id = ?', calendarID, function(err, rows, fields){
      if(err) throw err;
      var option = rows[0];
      var hour = option.hour;
      var now = new Date();

      if(option.repeatType == 0){
      //repeat theo ngay
      var schedule_date = now.getDate();
      if(now.getHours() > hour){
        schedule_date += 1;
      }
      solarDate = func.toStringDate(now.getFullYear(), now.getMonth()+1, schedule_date, hour, option.minute);

      }else if(option.repeatType == 1){
        //repeat theo thang
        var schedule = amduonglich.getNextSolarDateOfLunarDate(parseInt(option.minute), parseInt(hour), parseInt(option.date));
        console.log(schedule);
        solarDate = func.toStringDate(schedule[2], schedule[1], schedule[0], hour, option.minute);
      }else{
        //repeat theo nam
        var schedule = amduonglich.getNextSolarDateOfLunarDateAndMonth(parseInt(option.minute), parseInt(hour), parseInt(option.date), parseInt(option.month));
        console.log(schedule);
        solarDate = func.toStringDate(schedule[2], schedule[1], schedule[0], hour, option.minute);
        console.log(solarDate);
      };
        
      solarDate = new Date(solarDate);
      console.log('status: '+solarDate);
      //check pre
      option.pre_kind == 0 ? solarDate.setHours(solarDate.getHours() + parseInt(option.pre)) : solarDate.setDate(solarDate.getDate() + parseInt(option.pre));

      db.query('update calendar set solarDate = ? where id = ?', [solarDate, calendarID], function(err, rows, fields){
        if(err) throw err;
      })
    });
  };
  db.query('update calendar set status = ? where id = ?', [status, calendarID], function(err, rows, fields){
    if(err) throw err;
    if(rows.affectedRows != 0){
      return res.json(1);
    }else{
      return res.json(0);
    } 
  }); 
});

/*
 * routes: edit-event
 * input: params: id -- calendarID, body: object su kien
 * edit su kien co id.
 */
app.all('/account/edit-event/:id', ensureAuthenticated, function(req, res){
  res.setHeader('Content-Type', 'text/plain');
  var userID = req.user.userID;
  var calendarID = req.params.id;
  var option = req.body;
  var solardate;
  
  option.period === 'pm' ? hour = parseInt(option.hour) + 12 : hour = option.hour;
  var now = new Date();
  
  if(option.repeat == 0){
      //repeat theo ngay
      var schedule_date = now.getDate();
      if(now.getHours() > hour){
        schedule_date += 1;
      }
      solarDate = func.toStringDate(now.getFullYear(), now.getMonth()+1, schedule_date, hour, option.minute);

  }else if(option.repeat == 1){
    //repeat theo thang
    var schedule = amduonglich.getNextSolarDateOfLunarDate(parseInt(option.minute), parseInt(hour), parseInt(option.date));
    console.log(schedule);
    solarDate = func.toStringDate(schedule[2], schedule[1], schedule[0], hour, option.minute);
  }else{
    //repeat theo nam
    var schedule = amduonglich.getNextSolarDateOfLunarDateAndMonth(parseInt(option.minute), parseInt(hour), parseInt(option.date), parseInt(option.month));
    console.log(schedule);
    solarDate = func.toStringDate(schedule[2], schedule[1], schedule[0], hour, option.minute);
    console.log(solarDate);
  };
    
  solarDate = new Date(solarDate);
  console.log('2 '+solarDate);
  //check pre
  option.pre_kind.index == 0 ? solarDate.setHours(solarDate.getHours() + parseInt(option.pre)) : solarDate.setDate(solarDate.getDate() + parseInt(option.pre));

  var arr_calendar = [solarDate, option.desc,hour,option.minute,option.date,option.month,option.repeat,option.pre,option.pre_kind.index,1,1, calendarID];

  db.query('update calendar set solarDate = ?, message = ?, hour = ?, minute = ?, date = ?, month = ?, repeatType = ?, pre = ?, pre_kind = ?, active = ?, status = ? where id = ?', arr_calendar, function(err, rows, fiedls){
    if(err) throw err;
    if(rows.affectedRows != 0)
      return res.json(1);  
    else
      return res.json(0);
  });
});

/*
 * routes: create-event
 * input: body: object su kien
 * tao su kien moi.
 */
app.all('/account/create-event', ensureAuthenticated, function(req, res){
  res.setHeader('Content-Type', 'text/plain');
  var userID = req.user.userID;
  var option = req.body;

  console.log(option);
  option.period === 'pm' ? hour = parseInt(option.hour) + 12 : hour = option.hour;

  var solarDate;

  var now = new Date();
  if(option.repeat == 0){
    //repeat theo ngay
    var schedule_date = now.getDate();
    if(now.getHours() > hour){
      schedule_date += 1;
    }
    solarDate = func.toStringDate(now.getFullYear(), now.getMonth()+1, schedule_date, hour, option.minute);

  }else if(option.repeat == 1){
    //repeat theo thang
    var schedule = amduonglich.getNextSolarDateOfLunarDate(parseInt(option.minute), parseInt(hour), parseInt(option.date));
    solarDate = func.toStringDate(schedule[2], schedule[1], schedule[0], hour, option.minute);
  }else{
    //repeat theo nam
    var schedule = amduonglich.getNextSolarDateOfLunarDateAndMonth(parseInt(option.minute), parseInt(hour), parseInt(option.date), parseInt(option.month));
    solarDate = func.toStringDate(schedule[2], schedule[1], schedule[0], hour, option.minute);
  };

  solarDate = new Date(solarDate);

  //check pre
  option.pre_kind.index == 0 ? solarDate.setHours(solarDate.getHours() + parseInt(option.pre)) : solarDate.setDate(solarDate.getDate() + parseInt(option.pre));

  var arr_calendar = {
        userID    : userID,
        uuid      : option.udid,
        solarDate : solarDate, 
        message   : option.desc,
        hour      : hour,
        minute    : option.minute,
        date      : option.date,
        month     : option.month,
        repeatType: option.repeat,
        pre       : option.pre,
        pre_kind  : option.pre_kind.index,
        active    : 1,
        status    : 1,
        createTime: now,        
    };

  db.query('insert into calendar set ?', arr_calendar, function(err, rows, fiedls){
    if(err) throw err;

    return res.json(1);  
  });
});

/*
 * routes: update-email
 * input: params: email
 * cap nhat email nhan nhac nho moi.
 */
app.get('/account/update-email/:email', ensureAuthenticated, function(req, res){
  res.setHeader('Content-Type', 'text/plain');
  var userID = req.user.userID;
  var email = req.params.email;

  db.query('update users set email = ?, status = 0 where id = ?', [email, userID], function(err, rows, fields){
    if(err) throw err;

    if(rows.affectedRows != 0){

      var token = func.createToken();
      var expire = func.createExpire();
      var arr = {
            userID : userID,
            calendarID: 0,
            token : token,
            expire: expire
          };    

      db.query('insert into token set ?', arr, function(err, rows, fields){
        if(err) throw err;

        mailer.updateEmail(email, token);

        return res.json(1);
      });
    }
  });
});

/*
 * routes: auth-email
 * input: params: token
 * xac thuc email nguoi dung cap nhat.
 */
app.get('/account/auth-email/:token', function(req, res){
  var token = req.params.token;
  if(!token){
    res.render('404', {url: req.url});
    return;
  };

  token = encodeURIComponent(token);
  db.query('select * from token where token = ? limit 1', token, function(err, rows, fiels){
    if(err) throw err;
    console.log('account-auth-email: get record from token...');
    if(rows[0]){
      row = rows[0];
      var expire = row['expire'];
      var userID = row['userID'];
      var now = new Date().getTime();

      if(now < expire){
        console.log('account-auth-email: token  in expire...');
        async.parallel([
          function(callback){
            db.query('delete from token where token  = ?', token, function(err, rows, fields){
              if(err) throw err;
              console.log('account-auth-email: delete token...');
              
              callback();
            });
          },
          function(callback){
            db.query('update users set status = 1 where id = ?', userID, function(err, rows, fields){
              if(err) throw err;
              console.log('account-auth-email: update status users...');

              callback();
            });
          },
          function(callback){
            db.query('select email from users where id = ?', userID, function(err, rows, fields){
              if(err) throw err;
              if(rows[0]){
                mailer.notiUpdateEmailSuccess(rows[0].email);
                console.log('account-auth-email: send email...'+rows[0]);
              }

              callback();
            });
          }
        ], function(){
          //return res.send('1');
          return res.redirect('/#/event-list');
        })
      }
    }
  });
});

/*
 * routes: default-email
 * input: none
 * set email cua tai khoan dang nhap lam email nhan nhac nho.
 */
app.get('/account/default-email', ensureAuthenticated, function(req, res){
  res.setHeader('Content-Type', 'text/plain');
  var userID = req.user.userID;
  var email = req.user.email;

  db.query('update users set status = 1 where id = ?', userID, function(err, rows, fields){
    if(err) throw err;
    console.log('account-default-email: set email is default email');

    return res.json(1);
  });
});


app.get('/account/user', ensureAuthenticated, function(req, res){
  res.setHeader('Content-Type', 'text/plain');
  var userID = req.user.userID;
  console.log(req.user);
  //var email = req.user.email;

  db.query('select * from users where id = ?', userID, function(err, rows, fields){
    if(err) throw err;
    if(rows[0]){

      var row = rows[0];

      console.log(req.user.signup);
      var hasFacebook;
      row.facebook ? hasFacebook = 1 : hasFacebook = 0;

      var arr = {
        'name' : row.name,
        'email' : row.email,
        'signup' : req.user.signup,
        'hasFacebook' : hasFacebook
      }
      
      console.log(arr);

      res.json(arr);
    }
  });
});

app.get('/account/add-account',ensureAuthenticated, function(req, res){

  var old_account = req.user;
  req.session.oldAccount = old_account;
  console.log(old_account); 

  //var type = req.params.type;

  // if(type == 1)
  //   res.redirect('/auth/google');
  // if (type == 2)
    res.redirect('/auth/facebook');

});

/*
 * routes: login
 */

app.get('/login', function(req, res, next){
  return res.send('login');
});

app.get('/auth/google',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  });

app.get('/auth/google/return', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    res.setHeader('Content-Type', 'text/plain');
    var user = req.user;
    console.log(user);
    var name = user.displayName;
    var email = user.emails[0].value;

    if(!req.session.oldAccount){
      var callback = function(userID, signup){
      req.user.userID = userID;

      var arr = {
        'name'     : name,
        'email'    : email,
        'signup' : signup
      }
      //return res.json(arr);
      if(signup === 1 ){
        res.redirect('/#/confirm-sign-up');
        req.user.signup = 1;
      }else
        res.redirect('/#/event-list');
      }
      database.userLogin(name, email, email, 1, callback);
    }else{
      var callback = function(data){
        
        req.user = req.session.oldAccount;
        req.session.oldAccount = null;

        console.log(req.user);
        console.log(req.session.oldAccount);

        return res.send(data);
      }

      var check = req.session.oldAccount.id;
      database.addAccount(email, check, 1, callback);
    }
  });

app.get('/auth/facebook',
  passport.authenticate('facebook', {scope: ['email']}),
  function(req, res){
    res.redirect('/');
  });

app.get('/auth/facebook/callback',
  passport.authenticate('facebook', {failureRedirect: '/login' }),
  function(req, res) {
    res.setHeader('Content-Type', 'text/plain');
    var user = req.user;
    var username = user.username;
    var id = user.id;
    var name = user.displayName;
    var email = user.emails[0].value;
    
    if(!req.session.oldAccount){
      var callback = function(userID, signup){
      req.user.userID = userID;

      var arr = {
        'name'     : name,
        'email'    : email,
        'signup' : signup
      }
      //return res.json(arr);

      if(signup === 1 ){
        res.redirect('/#/confirm-sign-up');
        req.user.signup = 1;
      }else
        res.redirect('/#/event-list');
      }

      database.userLogin(name, id, email, 2, callback);
    }else{
      var callback = function(data){
        
        req.user = req.session.oldAccount;
        req.session.oldAccount = null;

        console.log(req.user);
        console.log(req.session.oldAccount);

        return res.json(data);
      }

      var check = req.session.oldAccount.emails[0].value;
      database.addAccount(id, check, 2, callback);
    }
  });

app.get('/logout', function(req, res){
  req.logout();
  return res.redirect('/');
});

/*
 * routes: error
 */

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
  var now = moment().zone("+07:00");
  var now_string = moment(now).format('YYYY-MM-DD HH:mm:ss');
  console.log(now_string);
  console.log('Express server listening on port ' + app.get('port'));

  console.log('master: version 4.0');

});


function ensureAuthenticated(req, res, next) {
  res.setHeader('Content-Type', 'text/plain');
  if (req.isAuthenticated()) { return next(); }
  return res.json(0);
}

function schedule(row){
  var schedule = row;
  var now = moment().zone("+07:00");
  var now_string = moment(now).format('YYYY-MM-DD');
  var now_hour = now.hours();
  var now_minute = now.minutes();
  var date = moment(row.solarDate);
  var date_string = date.format('YYYY-MM-DD');

  if(date_string === now_string){
    var hour = schedule.hour;
    if(now_hour === hour){
      var minute = schedule.minute;
      if(now_minute + 5 > minute && now_minute - 5 < minute){

        var repeatType = schedule.repeatType;
        var solarDate = new Date();
              
        if(repeatType == 0){
          // update lai ngay: ngay + 1
          var day = solarDate.getDate() + 1;
          solarDate.setDate(day);

        }else if(repeatType == 1){
          // update lai ngay moi cua thang sau
          var nextDate = amduonglich.getNextSolarDateOfLunarDate(parseInt(minute), parseInt(hour), parseInt(schedule.date));
      
          solarDate.setDate(nextDate[0]);
          solarDate.setMonth(nextDate[1]-1);
          solarDate.setFullYear(nextDate[2]);

        }else{
          // update lai ngay thang moi nam sau
          var nextDateMonth = amduonglich.getNextSolarDateOfLunarDateAndMonth(parseInt(minute), parseInt(hour),parseInt(schedule.date), parseInt(schedule.month));
          solarDate.setDate(nextDateMonth[0]);
          solarDate.setMonth(nextDateMonth[1]-1);
          solarDate.setFullYear(nextDateMonth[2]);
        }
      
        //check pre
        schedule.pre_kind == 0 ? solarDate.setHours(solarDate.getHours() + parseInt(schedule.pre)) : solarDate.setDate(solarDate.getDate() + parseInt(schedule.pre));

        console.log('schedule: '+solarDate);

        db.query('update calendar set solarDate = ? where id = ?', [solarDate, schedule.id], function(err, rows, fields){
          if(err) throw err;
          console.log('schedule: update calendar: '+schedule.id);

          console.log('schedule: '+now_string+' '+now_hour+':'+now_minute+'  Notification: '+schedule.userID+' - '+schedule.message);
          db.query('select facebook, email, type, status from users where id = ? limit 1', schedule.userID, function(err, rows, fields){
              if(err) throw err;

              if(rows[0]){
                if(rows[0].status){
                  console.log('schedule: get email form users: '+schedule.userID);
                  var time = '';     
                  switch(repeatType){
                    case 0:
                      time = 'Vào '+hour+' giờ '+(schedule.minute < 10 ? '0':'') + schedule.minute +' phút hàng ngày';break;
                    case 1:
                      time = 'Vào '+hour+' giờ '+(schedule.minute < 10 ? '0':'') + schedule.minute +' phút ngày '+(schedule.date == 100 ? 'cuối' : schedule.date)+' hàng tháng';break;
                    case 2:
                      time = 'Vào '+hour+' giờ '+(schedule.minute < 10 ? '0':'') + schedule.minute +' phút ngày '+(schedule.date == 100 ? 'cuối' : schedule.date)+' tháng '+schedule.month+' hàng năm';break
                  };
                  console.log('schedule: mailing... '+rows[0]['email']+' - '+schedule.message+' - '+time);
                        
                  var callback = function(res){
                    if(!res){
                      //khong gui duoc mail
                      var repeat_hour;
                      var repeat_minute;
                      if(now_minute + 15 < 60){
                        repeat_minute = now_minute + 15;
                        repeat_hour = now_hour;
                      }else{
                        repeat_minute = 15 - (60 - now_minute);
                        repeat_hour = now_hour + 1;
                      }
                      var arr = {
                        calendarID : schedule.id,
                        hour : repeat_hour,
                        minute : repeat_minute
                      };

                      db.query('insert into mail_error set ?', arr, function(err, rows, fields){
                        if(err) throw err;
                        console.log('insert mail err '+ rows.insertId);
                      });
                    }
                  }

                  if(rows[0].type == 0)
                    mailer.noti(0, rows[0]['email'], schedule.message, time,callback);
                  else if(rows[0].type == 1)
                    mailer.noti(1, rows[0]['email'], schedule.message, time,callback);
                }else{
                  console.log('schedule: email chua xac nhan de nhan nhac nho: '+rows[0].email);
                }

                if(rows[0].facebook != null){
                  var template = 'Thông báo: ';
                  schedule.message ?  template += schedule.message : template += 'không có nội dung';
                  template += ' '+time; 
                  facebook.notification(rows[0].facebook, config.constant.url, template);
                }
              }
          });
        });
      }
    }
  }
}


function mailErr(row){
  var now = moment().zone("+07:00");
  var now_string = moment(now).format('YYYY-MM-DD');
  var now_hour = now.hours();
  var now_minute = now.minutes();

  var hour = row.hour;
  var minute = row.minute;  

  if(now_hour === hour){
    if(now_minute + 5 > minute && now_minute - 5 < minute){

      db.query('select * from calendar where id = ? limit 1', row.calendarID, function(err, rows, fields){
        if(err) throw err;
        if(rows[0]){
          var schedule = rows[0];

          console.log('mail error: '+now_string+' '+now_hour+':'+now_minute+'  Notification: '+schedule.userID+' - '+schedule.message);
          db.query('select email from users where id = ? limit 1', schedule.userID, function(err, rows, fields){
              if(err) throw err;
              console.log('mail error: get email form users: '+schedule.userID);
              var time = '';     
              switch(schedule.repeatType){
                case 0:
                  time = 'Vào '+schedule.hour+' giờ '+(schedule.minute < 10 ? '0':'') + schedule.minute +' phút hàng ngày';break;
                          case 1:
                  time = 'Vào '+schedule.hour+' giờ '+(schedule.minute < 10 ? '0':'') + schedule.minute +' phút ngày '+(schedule.date == 100 ? 'cuối' : schedule.date)+' hàng tháng';break;
                          case 2:
                  time = 'Vào '+schedule.hour+' giờ '+(schedule.minute < 10 ? '0':'') + schedule.minute +' phút ngày '+(schedule.date == 100 ? 'cuối' : schedule.date)+' tháng '+schedule.month+' hàng năm';break
              };
              console.log('mail error: repeat mailing... '+rows[0]['email']+' - '+schedule.message+' - '+time);
              var callback = function(res){
                if(res){
                    db.query('delete from mail_error where id = ?', row.id, function(err, rows, fields){
                      if(err) throw err;
                      console.log('mail err: delete from mail_error');
                    });
                }else{
                        //khong gui duoc mail
                        var repeat_hour;
                        var repeat_minute;
                        if(now_minute + 15 < 60){
                          repeat_minute = now_minute + 15;
                          repeat_hour = now_hour;
                        }else{
                          repeat_minute = 15 - (60 - now_minute);
                          repeat_hour = now_hour + 1;
                        }

                        db.query('update mail_error set hour = "'+repeat_hour+'", minute = "'+repeat_minute+'" where id = ?',row.id , function(err, rows, fields){
                          if(err) throw err;
                          console.log('mail err: update mail_error '+ row.id);
                        });
                }
              };
              mailer.noti(rows[0]['email'], schedule.message, time, callback);
          });
        }
      });
    }
  }
}