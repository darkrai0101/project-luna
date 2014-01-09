
var uuid = require('uuid');

exports.createToken = createToken;
exports.createExpire = createExpire;
exports.toStringDate = toStringDate;
exports.sortEvents = sortEvents;

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


function sortEvents(arr){

	var length = arr.length;
	var flag = 0;

	for(var j = length -1; j >= 0; j--){
		flag = 0;
		for(var i = 0; i < length-1; i++){
			if(arr[i].solarDate < arr[i+1].solarDate){
				var temp = arr[i+1];
				arr[i+1] = arr[i];
				arr[i] = temp;
				flag = 1;
			}
		}
		if(flag === 0) break;
	}
	return (arr);
}
