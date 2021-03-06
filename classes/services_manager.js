// constructor call
var neDatastore = require('nedb');
var events = require('events');
var Webserver = require('../services/webserver.js');
var Route = require('../classes/route.js');

function ServiceManager() {	
	this.loaded_services_counter = 0;
	this.found_services_counter = 0;
	this.services_loaded = new Array();
	this.database_manager = null;
	this.webserver = null;
}

ServiceManager.prototype.set_db_manager = function (db_manager) {
	this.database_manager = db_manager;
}

ServiceManager.prototype.api_add_service = function(webrequest) {
	if (typeof webrequest.query.name !== 'undefined') {
		var self = this;
		service_name = webrequest.query.name;
		var doc = { service_name: service_name };
		service_manager_db.insert(doc, function (err, newDoc) {   // Callback is optional
			console.log("Service " + newDoc._id + " added");
			self.load_service(doc, function () {
			});
			webrequest.res.write(JSON.stringify({ success: true, id: doc._id }));
			webrequest.res.end();
		});
	} else {
		webrequest.res.write(JSON.stringify({ success: false }));
		webrequest.res.end();
	}
}

ServiceManager.prototype.get_service = function (service_id) {
	//console.log("inside get_service");
	var retour = null;
	this.services_loaded.forEach( function (entry) {
		//console.log("comparing " + service_id + " with " + entry.service_id);
		if (service_id == entry.service_id) {
			console.log("We found it");
			retour = entry;
		}
	});
	return retour;
}

ServiceManager.prototype.load_service = function (service_to_load) {
	var self = this;
	console.log("Load service : " + service_to_load.service_name);
	var newService = require("../services/" + service_to_load.service_name + ".js");
	var the_newService = new newService();
	the_newService.load(service_to_load._id, function() {
		console.log("Service loaded");
		self.services_loaded.push(the_newService);
		console.log("Service running? " + the_newService.running);
		if (the_newService.running) {						
			the_newService.routes.forEach(function (route) {
				console.log("Found a route to add");
				self.webserver.addroute(route);
			});
		}
	});
}

ServiceManager.prototype.start = function () {
	var self = this;
	
	route1 = new Route("*","GET","/api/services/add", function (webrequest) { 
		console.log("Add Service");
		self.api_add_service(webrequest, function () {
		});
	});
	route2 = new Route("*","GET","/api/services/list", function (webrequest) { 
		console.log("List Service");
	});

	this.routes = [route1, route2];

	// Lance le webserver pour les routes et aussi les APIs
	self.webserver = new Webserver();
	this.webserver.config.port = 80;
	this.services_loaded.push(this.webserver);
	this.webserver.start(function() {});
	
	this.webserver.addroute(route1);
	this.webserver.addroute(route2);
	
	// Startup script
	service_manager_db = new neDatastore({ filename: 'datas/services_manager', autoload: true });
	this.service_manager_db = service_manager_db;
	service_manager_db.loadDatabase(function (err) {
		if (self.database_manager !== null)
			self.database_manager.add_database("services_db",service_manager_db);
		if (err) {
			console.log("Error loading services_manager");
			return;
		}
		// Now commands will be executed
		console.log("services_manager db loaded");
	
		/*
		service_manager_db.remove({ }, {}, function (err, numRemoved) {
			  console.log(numRemoved + ' services deleted');
		});	
		*/
	
		// Find all documents in the collection
		service_manager_db.find({}, function (err, services_to_load) {
			self.found_services_counter++;
			console.log(services_to_load);
			services_to_load.forEach( function (the_service) {
				self.load_service(the_service, function () {
					self.loaded_services_counter++;
				});
			});
	
			/*
			console.log(found_services_counter  + ' services found');
			if (loaded_services_counter == 0) {		
				// C'est le 1iere fois qui installe qqch
				var doc = { service_name: 'load_balancer', port: 80 };
				service_manager_db.insert(doc, function (err, newDoc) {   // Callback is optional
					console.log("Service " + newDoc._id + " added");
				// newDoc is the newly inserted document, including its _id
				// newDoc has no key called notToBeSaved since its value was undefined
				});
			}
			*/
			//module.exports.emit('ready');
		});
	});
}

module.exports = ServiceManager;