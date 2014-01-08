var config = require('../config/config');
var facebook_sdk = require('facebook-node-sdk');

var facebook = new facebook_sdk({
	appID  : config.fb.appId,
	secret : config.fb.appSecret
}).setAccessToken(config.fb.appId+'|'+config.fb.appSecret);

function notification(FID, href, template){
	facebook.api('/'+FID+'/notifications', 'POST',{
		"href" : href,
		"template" : template,
	}, function(err, data){
		console.log("facebook notification: "+data);
		console.log("facebook notification: "+err);
	});
}

exports.notification = notification;