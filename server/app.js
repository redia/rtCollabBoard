/**
 * Main application file
 */

'use strict';

// Set default node environment to development
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var https = require('https');
var fs = require('fs');
var sslOptions = {
  key: fs.readFileSync('/home/ubuntu/ssl/server.key'),
  cert: fs.readFileSync('/home/ubuntu/ssl/server.crt'),
  ca: fs.readFileSync('/home/ubuntu/ssl/ca.crt'),
  requestCert: true,
  rejectUnauthorized: false
};
var express = require('express');
var config = require('./config/environment');
// Setup server
var app = express();
var server = https.createServer(sslOptions,app);
var settings = require('./settings.js');
var draw = require('./draw.js');
var tests = require('./tests.js');
var projects = require('./projects.js');
var paper = require('paper');
var db = require('./db.js');

require('./config/express')(app);
require('./routes')(app);

var globalRoom = {};

var io = require('socket.io').listen(server);
io.sockets.on('connection', function(socket) {
  socket.on('connected', function(data) {
    socket.broadcast.emit('onUserConnected', data);
  });
  socket.on('createNote', function(data) {
    socket.broadcast.emit('onNoteCreated', data);
  });
  socket.on('updateNote', function(data) {
    socket.broadcast.emit('onNoteUpdated', data);
  });
  socket.on('moveNote', function(data) {
    socket.broadcast.emit('onNoteMoved', data);
  });
  socket.on('moveMovie', function(data) {
    socket.broadcast.emit('onMovieMoved', data);
  });
  socket.on('deleteNote', function(data) {
    socket.broadcast.emit('onNoteDeleted', data);
  });
  socket.on('createMovie', function(data) {
    io.sockets.emit('onMovieCreated', data);
  });
  socket.on('startMovie', function() {
    socket.broadcast.emit('onMovieStarted');
  });
  socket.on('stopMovie', function() {
    socket.broadcast.emit('onMovieStopped');
  });
  socket.on('muteMovie', function() {
    socket.broadcast.emit('onMovieMuted');
  });
  socket.on('unMuteMovie', function() {
    socket.broadcast.emit('onMovieUnMuted');
  });
  socket.on('draw:progress', function(room, uid, co_ordinates) {
    io.in(room).emit('draw:progress', uid, co_ordinates);
    draw.progressExternalPath(room, JSON.parse(co_ordinates), uid);
  });
  socket.on('draw:end', function(room, uid, co_ordinates) {
    io.in(room).emit('draw:end', uid, co_ordinates);
    draw.endExternalPath(room, JSON.parse(co_ordinates), uid);
  });
  socket.on('subscribe', function(data) {
    globalRoom = data;
    subscribe(socket, data);
  });
  socket.on('canvas:clear', function(room) {
    draw.clearCanvas(room);
    io.in(room).emit('canvas:clear');
  });
  socket.on('item:remove', function(room, uid, itemName) {
    draw.removeItem(room, uid, itemName);
    io.sockets.in(room).emit('item:remove', uid, itemName);
  });
  socket.on('item:move:progress', function(room, uid, itemNames, delta) {
    draw.moveItemsProgress(room, uid, itemNames, delta);
    if (itemNames) {
      io.sockets.in(room).emit('item:move', uid, itemNames, delta);
    }
  });
  socket.on('item:move:end', function(room, uid, itemNames, delta) {
    draw.moveItemsEnd(room, uid, itemNames, delta);
    if (itemNames) {
      io.sockets.in(room).emit('item:move', uid, itemNames, delta);
    }
  });
  socket.on('image:add', function(room, uid, data, position, name) {
    draw.addImage(room, uid, data, position, name);
    io.sockets.in(room).emit('image:add', uid, data, position, name);
  });
  socket.on('disconnect', function() {
    unsubscribe(socket, globalRoom);
  });
});

function subscribe(socket, data) {
  var room = data.room;
  socket.join(room);
  var project = projects.projects[room];
  if (!project) {
    console.log("made room");
    projects.projects[room] = {};
    projects.projects[room].project = new paper.Project();
    projects.projects[room].external_paths = {};
    db.load(room, socket);
  } else {
    loadFromMemory(room, socket);
  }
  var rooms = socket.adapter.rooms[room];
  var roomUserCount = Object.keys(rooms).length;
  io.to(room).emit('user:connect', roomUserCount);
}

function unsubscribe(socket, data) {
  var room = data.room;
  var rooms = socket.adapter.rooms[room];
  var roomUserCount = Object.keys(rooms).length;
  io.to(room).emit('user:disconnect', roomUserCount);
}

function loadFromMemory(room, socket) {
  var project = projects.projects[room].project;
  if (!project) {
    db.load(room, socket);
    return;
  }
  socket.emit('loading:start');
  var value = project.exportJSON();
  socket.emit('project:load', {
    project: value
  });
  socket.emit('loading:end');
}

function loadError(socket) {
  socket.emit('project:load:error');
}

// Start server
server.listen(config.port, config.ip, function () {
  console.log('Express server listening on %d, in %s mode', config.port, app.get('env'));
});



// Expose app
exports = module.exports = app;
