
var uuid = require('uuid');

exports.createToken = createToken;
exports.createExpire = createExpire;
exports.toStringDate = toStringDate;

function createToken(){
  var token = uuid.v1({
      node: [0x01, 0x23, 0x45, 0x67, 0x89, 0xab],
      clockseq: 0x1234,
      msecs: new Date().getTime(),
      nsecs: 5678
    });
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

