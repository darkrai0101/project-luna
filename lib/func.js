
var uuid = require('uuid');

exports.createToken = createToken;
exports.createExpire = createExpire;
exports.toStringDate = toStringDate;

function createToken(){
  var token = uuid.v4();
  return token;
};

function createExpire(){
  var time = new Date().getTime();
  time = time + 10800000;
  console.log(time);
  return time;
}

function toStringDate(year, month, date, hour, minute){
  var string = year+'-'+month+'-'+date+' '+hour+':'+minute+':00';
  return string;
}

