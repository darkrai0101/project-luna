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

var template = {
  top: '<!doctype html> <html lang="en"> <head> <meta charset="UTF-8"> <link rel="stylesheet" href="style.css"> </head> <body style="display: block;margin: 0;padding: 0;background-color: #fafafa;"> <table style="height: auto;border-collapse: collapse; border: 1px solid #CCC; margin: 2em auto;"> <tbody style="width: 100%;display: block;"> <tr class="header" style="color: #444750;width: 100%; border: none"> <td style="width: 100%;height: 50px;"> <h2 style="float: right;margin-right: 42px;width: 218px;font-size:30px;text-align:left;padding: 1em 0px 5px 0px;text-align:right;font-family:sans-serif,arial;font-weight:lighter;border-bottom: 2px solid #444750;"> âm dương lịch </h2> </td> </tr> <tr class="main" style="color: #444750;padding: 0px 52px;line-height: 2em;width: 100%;"> <td style="width: 100%;"> <div style="display: block; padding: 2em 42px; text-align: justify; font-family: sans-serif">',
  homepage: '<a style="font-style:italic;color:inherit;text-decoration: none;" href="http://amduonglich.com">amduonglich.com</a>',
  quote: function(content){
    return '<p style="color: #444750; border-left: #444750 2px solid; padding-left: 1em; margin: 1.5em 2em 0 2em">'+content+'</p>'
  },
  button: function(url,text){
    return '<p style="color: #444750; text-align: center; margin: 1.5em auto 2.5em auto;"> <a style="text-decoration: none; color: #f6f6f6; background: #444750; padding: 1em; font-weight:bold; cursor: pointer; font-size: inherit;" href="'+url+'">'+text+'</a></p>'
  },
  email: '<a style="font-style:italic;color:inherit;text-decoration: none;" href="mailto:amduonglich@gmail.com">amduonglich@gmail.com</a>',
  bottom: '<p style="color:#444750">Xin chân thành cám ơn,</p><p style="color:#444750">Nhóm Mininoic</p></div> </td> </tr> <tr class="footer" style="color: #F6F6F6;background-color: #444750;padding: 0px 10px;width: 100%;"> <td style="width: 100%;"> <h4 style="font-family: sans-serif;font-weight: lighter;color: inherit;font-size: 14px;text-align: center;"> @ 2013 mininoic&nbsp;&nbsp;|&nbsp; All rights reserved </h4> </td> </tr> </tbody> </table> </body> </html>'
};

function authMail(email, token, desc, time){
      var url = config.constant.url+"/user/auth-token/"+token;
      if (!desc || /^\s*$/.test(desc))
        desc = '<span style="font-style:italic">Không có nội dung</span>';

      var html = template.top
      +'<p style="color:#444750">Xin chào,</p>'
      +'<p style="color:#444750">Bạn nhận được email này vì bạn hoặc ai đó đã sử dụng địa chỉ email của bạn để đăng ký một nhắc nhở theo lịch âm tại '+template.homepage+' với nội dung như sau:</p>'
      +template.quote(desc+'<br/>'+time)
      +template.button(url,'Xác nhận tạo nhắc nhở')
      +'<p style="color:#444750">Nếu bạn không đăng ký nhắc nhở này, xin hãy xóa email hoặc thông báo cho nhóm chúng tôi thông qua địa chỉ email '+template.email+'.</p>'
      +template.bottom;

      var message = {
      from: 'amduonglich <amduonglich@gmail.com>',
      to: '<"'+email+'">',
      subject: '[Âm dương lịch] Xác nhận tạo nhắc nhở theo lịch âm', 
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


function notiMail(email, desc, time){
  if (!desc || /^\s*$/.test(desc))
        desc = '<span style="font-style:italic">Không có nội dung</span>';
  var html = template.top
      +'<p style="color:#444750">Xin chào,</p>'
      +'<p style="color:#444750">Bạn nhận được email này vì bạn đã đăng ký một nhắc nhở theo lịch âm tại '+template.homepage+' với nội dung như sau:</p>'
      +template.quote(desc+'<br/>'+time)
      +'<p style="color:#444750">Nếu bạn không đăng ký nhắc nhở này, xin hãy thông báo cho nhóm chúng tôi thông qua địa chỉ email '+template.email+'. Bạn có thể xóa nhắc nhở bằng nút dưới đây.</p>'
      +template.button(config.constant.url+'#/delete','Xóa nhắc nhở')
      +template.bottom;
  var message = {
      from: 'amduonglich <amduonglich@gmail.com>',
      to: '<"'+email+'">',
      subject: '[Âm dương lịch]'+desc.substr(0,60)+'...', 
      headers: {
          'X-Laziness-level': 1000
      },
      html: html,
    };
    transport.sendMail(message, function(error){
        if(error){
            console.log('Error occured');
            console.log(error.desc, time);
            return;
        }
        console.log('Message sent successfully notification Mail to:'+email);
    });
}

function thankMail(email){

  var html = template.top
      +'<p style="color:#444750">Xin chào,</p>'
      +'<p style="color:#444750">Cám ơn bạn đã sử dụng dịch vụ của chúng tôi. Nhắc nhở của bạn đã được cài đặt, chúng tôi sẽ gửi email thông báo cho bạn vào thời gian bạn đã thiết lập.</p>'
      +template.bottom;
  var message = {
      from: 'amduonglich <amduonglich@gmail.com>',
      to: '<"'+email+'">',
      subject: '[Âm dương lịch] Tạo nhắc nhở thành công', 
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

  var html = template.top
      +'<p style="color:#444750">Xin chào,</p>'
      +'<p style="color:#444750">Sau đây là danh sách các nhắc nhở bạn đã tạo tại '+template.homepage+'.</p>';
      
  var link = '';
  for(var p in option){
    var event = option[p];
    var desc = event.message;
    if (!desc || /^\s*$/.test(desc))
        desc = '<span style="font-style:italic">Không có nội dung</span>';
    html += template.quote(desc+'<br/>'+event.time)
      +template.button(event.link,'Xóa nhắc nhở này');
  };
  html += template.bottom;

  var message = {
      from: 'amduonglich <amduonglich@gmail.com>',
      to: '<"'+email+'">',
      subject: '[Âm dương lịch] Xóa nhắc nhở', 
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