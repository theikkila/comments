// Dependencies and globals

var path 			= require('path');
var express         = require('express');
var bodyParser      = require('body-parser');
var bcrypt 			= require('bcrypt');
var mongoose 		= require('mongoose');
var session    		= require('express-session');
var MongoStore 		= require('connect-mongo')(session);


var app     		= express();

var config 			= require('./config');

// Mongoose init
mongoose.connect('mongodb://'+config.mongo.host+'/'+config.mongo.db);

// Mongoose models
var Page = mongoose.model('Page', {site:String, name:String, comments:[{author:String, date:{type:Date, default:new Date()}, content:String}]});
var Owner = mongoose.model('Owner', {name:String, email:String, sites:[{name:String}], password:String});


app.use(session({
	secret: config.session_secret,
	store: new MongoStore({
		db : config.mongo.db,
		host: config.mongo.host
	})
}));

app.use(bodyParser());
app.use(express.static(path.join(__dirname, 'public')));
// Use JSONP because of cross origin requests
app.set("jsonp callback", true);



app.listen(config.port);
console.log("App running on", config.port);

