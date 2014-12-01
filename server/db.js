var settings = require('./settings.js'),
    projects = require('./projects.js'),
     ueberDB = require('ueberDB')

// Database connection
var db = new ueberDB.database(settings.dbType, settings.dbSettings);

// Write to teh database
exports.storeProject = function(room) {
  var project = projects.projects[room].project;
  var json = project.exportJSON();
  db.init(function (err) {
    if(err) {
      console.error(err);
    }
    console.log("Writing project to database");
	db.remove(room, function(){
	    db.set(room, {project: json});
	});

  });
}

// Write to teh database
exports.deleteProject = function(room) {
  db.init(function (err) {
    if(err) {
      console.error(err);
    }
    console.log("Writing project to database");
	db.remove(room);
  });
}

// Try to load room from database
exports.load = function(room, socket) {
  console.log("load from db");
  if (projects.projects[room] && projects.projects[room].project) {
    var project = projects.projects[room].project;
    db.init(function (err) {
      if(err) {
        console.error(err);
      }
      console.log("Initting db");
      db.get(room, function(err, value) {
//        if (value && project && project instanceof drawing.Project && project.activeLayer) {
        if (value && project && project.activeLayer) {
          socket.emit('loading:start');
          // Clear default layer as importing JSON adds a new layer.
          // We want the project to always only have one layer.
          project.activeLayer.remove();
          project.importJSON(value.project);
          socket.emit('project:load', value);
        }
        socket.emit('loading:end');
        db.close(function(){});
      });
      socket.emit('loading:end'); // used for sending back a blank database in case we try to load from DB but no project exists
    });
  } else {
    loadError(socket);
  }
}

function loadError(socket) {
  socket.emit('project:load:error');
}
