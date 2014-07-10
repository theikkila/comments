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

/*
* UTILITY FUNCTIONS
*/

// helper function for authorization
// Todo: change to lodash alternative / clean up its messy after hacking ;)
function containsSite(array, site){
	var r = false;
	if(!array) return false;
	if(array.length <= 0) return false;
	array.forEach(function(obj){
		if (obj.name == site) {
			r = true;
		}
	});
	return r;
}

// checks if user has rights to remove comments
// Todo: change it to middleware
function authorized(sites, site, name, cb){
	Page.findOne({site:site, name:name}, function(err, page){
		if(!page){
			cb(false);
			return;
		}
		if(containsSite(sites, page.site)){
			cb(true);
		}else{
			cb(false);
		}
	});
}

/* 
* ROUTES
*/

// The main callback, returns if authorized to remove comments and returns the comments of page
// Todo: get rid of if-else-callback-fucking-jungle
app.get('/comments', function(req, res){
	// Is authorized?
	authorized(req.session.sites, req.query.site, req.query.page, function(auth){
		// find page for the site
		Page.findOne({site:req.query.site, name:req.query.page}, function(err, page){
			// if found return it and render also if authorized to make changes
			if(page) res.jsonp({authorized:auth, page:page});
			else{
				// Page not found, so create one!
				var p = new Page({site:req.query.site, name:req.query.page});
				p.save(function(err, page){
					res.jsonp({authorized:auth, page:page});
				})
			}
		});
	});
});



app.listen(config.port);
console.log("App running on", config.port);

