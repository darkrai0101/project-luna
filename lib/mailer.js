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
exports.deleteEvent = deleteEventMail;

function authMail(email, token){
      var url = config.constant.url+"/user/auth-token/"+token;
      var html = "Bạn đã tạo nhắc nhở, vui lòng nhấn vào link bên dưới để kích hoạt";
      html += "<br /><a href='"+url+"'>"+url+"</a>";

      var message = {
      from: 'amduonglich <amduonglich@gmail.com>',
      to: '<"'+email+'">',
      subject: 'Xác nhận tạo nhắc nhở', 
      headers: {
          'X-Laziness-level': 1000
      },
      html:html,
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
  var html = message;
  var message = {
      from: 'amduonglich <amduonglich@gmail.com>',
      to: '<"'+email+'">',
      subject: 'Thông báo sự kiện', 
      headers: {
          'X-Laziness-level': 1000
      },
      html: html,
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

  var html = "Xác thực thành công, nhắc nhở của bạn đã được tạo.<br/><br/>Cám ơn bạn đã sử dụng dịch vụ của chúng tôi.";
  var message = {
      from: 'amduonglich <amduonglich@gmail.com>',
      to: '<"'+email+'">',
      subject: 'Tạo nhắc nhở thành công', 
      headers: {
          'X-Laziness-level': 1000
      },
      html:html,
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

function deleteEventMail(email, option){

  var html = "Dưới đây là danh sách các nhắc nhở hiện có của bạn.<br />";
  html += "Click vbanjlink tương ứng với nhắc nhở cần xóa.";
  
  var link = '';
  for(var p in option){
    var event = option[p];
    link += '<li><p>'+event.time+'</p><p>'+event.message+'</p><p><a href="'+event.link+'">'+event.link+'</a></p></li>';
  };

  html += link;

  var message = {
      from: 'amduonglich <amduonglich@gmail.com>',
      to: '<"'+email+'">',
      subject: 'Xóa nhắc nhở', 
      headers: {
          'X-Laziness-level': 1000
      },
      html: html,
  };

  transport.sendMail(message, function(error){
        if(error){
            console.log('Error occured');
            console.log(error.message);
            return;
        }
        console.log('Message sent successfully delete event to: '+email);
    });
}