// Dependencies and globals

var path 			= require('path');
var express         = require('express');
var bodyParser      = require('body-parser');
var bcrypt 			= require('bcrypt');
var mongoose 		= require('mongoose');
var session    		= require('express-session');
var MongoStore 		= require('connect-mongo')(session);
var fs 				= require('fs');
var hogan 			= require('hogan.js');


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

// Render mustache-templates with hogan
var render = function(filename, data, cb){
	fs.readFile(__dirname+'/templates/'+filename, function(err, template_content){
		if(err) throw err;
		var template = hogan.compile(template_content.toString());
		cb(template.render(data));
	});
}

// return response with commenting-form
var commentform = function(req, res){
	var data = {site:req.query.site, page:req.query.page};
	render('form.html', data, function(rendered){
		res.send(rendered);
	});
};

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


/*
* Comment form (IFRAME) [render stuff in server]
*/

// render comment-form for iframe
app.get('/comment', commentform);

// process new comment
app.post('/comment', function(req, res){

	Page.findOne({site:req.query.site, name:req.query.page}, function(err, page){
		if(err) throw err;
		if(!page) page = new Page({site:req.query.site, name:req.query.page});

		var c = {author:req.body.name, content:req.body.content};
		// push new comment
		page.comments.push(c);
		page.save(function(err, page){
			// Show the comment-form again
			commentform(req, res);
		});
	});
});


/*
* Login form (IFRAME) [render stuff in server]
*/
// Render login-form
app.get('/login', function(req, res){
	var data = {loggedin:req.session.loggedin};
	render('login.html', data, function(rendered){
		res.send(rendered);
	});
});

// Process login
app.post('/login', function(req, res){
	var message = null;
	Owner.findOne({email:req.body.username}, function(err, own){
		// check the credientials
		if(own && bcrypt.compareSync(req.body.password, own.password)){
			// User credientials OK let em in
			req.session.loggedin = true;
			req.session.sites = own.sites;
		}else{
			// Login failed
			req.session.loggedin = false;
			req.session.sites = [];
			message = "The username or password you entered is incorrect."
		}

		var data = {loggedin:req.session.loggedin, message:message};
		render('login.html', data, function(rendered){
			res.send(rendered);
		});
	});

});

// logout route

app.get('/logout', function(req, res){
	req.session.loggedin = false;
	req.session.sites = [];
	res.redirect('/login');
});


app.listen(config.port);
console.log("App running on", config.port);

