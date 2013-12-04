var nodemailer = require('nodemailer');
var config = require('../config/config');

var config_mail = config.mail;
var transport = nodemailer.createTransport("SMTP", {
          service: 'Gmail',
          auth: {
              user: config_mail.email,
              pass: config_mail.password
          }
  		});

exports.auth = authMail;
exports.noti = notiMail;
exports.thankReg = thankMail;

function authMail(email, token){
	  // send email
      var message = {
      from: 'mininoic <nv.trung91@gmail.com>',
      to: '<"'+email+'">',
      subject: 'mail xac nhan', 
      headers: {
          'X-Laziness-level': 1000
      },
      text: 'click vao link',
      html:'<a href="'+config.constant.url+'/user/auth-token/'+token+'">Xac nhan</a>',
      };
      transport.sendMail(message, function(error){
          if(error){
              console.log('Error occured');
              console.log(error.message);
              return;
          }
          console.log('Message sent successfully auth Mail to:'+email);
      });
}


function notiMail(email, message){
	var message = {
      from: 'mininoic <nv.trung91@gmail.com>',
      to: '<"'+email+'">',
      subject: 'noti for event', 
      headers: {
          'X-Laziness-level': 1000
      },
      text: 'hi!!',
      html:'thong bao: '+message,
	  };
	  transport.sendMail(message, function(error){
	      if(error){
	          console.log('Error occured');
	          console.log(error.message);
	          return;
	      }
	      console.log('Message sent successfully notification Mail to:'+email);
	  });
}

function thankMail(email){
  var message = {
      from: 'mininoic <nv.trung91@gmail.com>',
      to: '<"'+email+'">',
      subject: 'thanks', 
      headers: {
          'X-Laziness-level': 1000
      },
      text: 'xac thuc thanh cong. Cam on da su dung dich vu cua chung toi',
      html:'notification'
    };
    transport.sendMail(message, function(error){
        if(error){
            console.log('Error occured');
            console.log(error.message);
            return;
        }
        console.log('Message sent successfully thanks Mail to:'+email);
    });
}