var app = angular.module('app', ['toaster']);
var connection_file = new RTCMultiConnection('sma79');
app.directive('stickyNote', function(socket) {
	var linker = function(scope, element, attrs) {
			element.draggable({
				stop: function(event, ui) {
					socket.emit('moveNote', {
						id: scope.note.id,
						x: ui.position.left,
						y: ui.position.top
					});
				}
			});

			socket.on('onNoteMoved', function(data) {
				// Update if the same note
				if(data.id == scope.note.id) {
					element.animate({
						left: data.x,
						top: data.y
					});
				}
			});

			// Some DOM initiation to make it nice
			element.css('left', '10px');
			element.css('top', '50px');
			element.hide().fadeIn();
		};

	var controller = function($scope) {
			// Incoming
			socket.on('onNoteUpdated', function(data) {
				// Update if the same note
				if(data.id == $scope.note.id) {
					$scope.note.body = data.body;
				}
			});

			// Outgoing
			$scope.updateNote = function(note) {
				socket.emit('updateNote', note);
			};

			$scope.deleteNote = function(id) {
				$scope.ondelete({
					id: id
				});
			};
		};

	return {
		restrict: 'A',
		link: linker,
		controller: controller,
		scope: {
			note: '=',
			ondelete: '&'
		}
	};
});

app.directive('stickyMovie', function(socket) {
	var linker = function(scope, element, attrs) {
			element.draggable({
				stop: function(event, ui) {
					socket.emit('moveMovie', {
						x: ui.position.left,
						y: ui.position.top
					});
				}
			});

			socket.on('onMovieMoved', function(data) {
				// Update if the same note

					element.animate({
						left: data.x,
						top: data.y
					});

			});

			// Some DOM initiation to make it nice
			element.css('left', '10px');
			element.css('top', '50px');
			element.hide().fadeIn();
		};

	return {
		restrict: 'A',
		link: linker,
		scope: {
			movie : '=',
			ondelete: '&'
		}
	};
});

app.directive('movieUrlSender', function(socket) {
	return {
		restrict: 'A',
		require: 'ngModel',
		link: function(scope, element, attrs, ctrl) {
			var $el = $(element[0]);
			element.bind('keydown', function(e) {
				if(e.keyCode === 13) {
					if($el.val().length>8){
						movie = {
							id : new Date().getTime(),
							url : $el.val()
						};
						socket.emit('createMovie', movie);
					}
				}
			});
		}
	}
});

app.directive("ngAutoExpand", function($timeout) {
	var $window = $(window);
	return {
		restrict: 'A',
		link: function( $scope, elem, attrs) {
			var handler;
			$scope.$watch(function(newVal, oldVal) {
					$(elem).height(0);
					var height = $(elem)[0].scrollHeight;
					$(elem).height(height+1);
				handler = function($event){
					$(elem).height(0);
					var height = $(elem)[0].scrollHeight;
					$(elem).height(height);
				};
//				elem.bind("keyup", handler);
				elem.bind("change", handler);
				return elem.on('$destroy', function() {
//					return elem.unbind("keyup", handler);
					return elem.unbind("change", handler);
				});
			});
		}
	};
});


app.factory('socket', function($rootScope) {
	var socket = io.connect('https://54.65.49.210',{secure: true});
	return {
		on: function(eventName, callback) {
			socket.on(eventName, function() {
				var args = arguments;
				$rootScope.$apply(function() {
					callback.apply(socket, args);
				});
			});
		},
		emit: function(eventName, data, callback) {
			socket.emit(eventName, data, function() {
				var args = arguments;
				$rootScope.$apply(function() {
					if(callback) {
						callback.apply(socket, args);
					}
				});
			});
		}
	};
});

app.controller('MainCtrl', function($scope, socket, toaster) {
  $scope.isShow=0;
	var config =  {
			playlist: {
				title: 'Random videos',
				videos: [
					{ id: ''}
				]
			},
			toolbar: 'play,mute',
			socket : socket
		};

	var player = $('.youtube-player').player(config);
	var movie;

	$scope.notes = [];
	$scope.movies = [];
	$scope.movieVal = '';

	socket.emit('connected',new Fingerprint().get());

	socket.on('onUserConnected', function(data) {
		var parameter_noti = {
			title:"RealTime TaskBoard",
			icon:"http://img.tstore.co.kr/thumbnails/img_sac/80_80_F10_100/data6/android/201409/06/IF1424001480520140418200845/0000673519/img/original/0000673519_DP000101.png",
			body:"접속자"+data+"님이 입장했습니다."
		};
		if (!"Notification" in window) {
			alert("This browser does not support desktop notification");
		}
		else if (Notification.permission === "granted") {
			var notification = new Notification(parameter_noti.title,{
				icon:parameter_noti.icon,
				body:parameter_noti.body
			});
		}
		else if (Notification.permission !== 'denied') {
			Notification.requestPermission(function (permission) {
				if(!('permission' in Notification)) {
					Notification.permission = permission;
				}
				if (permission === "granted") {
					var notification = new Notification(parameter_noti.title,{
						icon:parameter_noti.icon,
						body:parameter_noti.body
					});
				}
			});
		}
		toaster.pop("note","","접속자"+data+"님이 입장했습니다.");
	});

	socket.on('onMovieCreated', function(data) {
		$scope.movies.push(data);
		$scope.createMovie(data);
	});

	socket.on('onMovieStarted', function() {
		$(".ui-icon-play").trigger("click");
	});

	socket.on('onMovieStopped', function() {
		$(".ui-icon-pause").trigger("click");
	});

	socket.on('onMovieUnMuted', function() {
		$(".youtube-player-toolbar>li.ui-state-active>span.ui-icon-volume-on").trigger("click");
	});

	socket.on('onMovieMuted', function() {
		$(".youtube-player-toolbar>li:not(.ui-state-active)>span.ui-icon-volume-on").trigger("click");
	});

	socket.on('onNoteCreated', function(data) {
		$scope.notes.push(data);
	});

	socket.on('onNoteDeleted', function(data) {
		$scope.handleDeletedNoted(data.id);
	});

	// Outgoing
	$scope.createNote = function() {
		var note = {
			id: new Date().getTime(),
			body: ''
		};

		$scope.notes.push(note);
		socket.emit('createNote', note);
	};

	$scope.createMovie = function(data){
		data.url =  data.url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/user\/\S+|\/ytscreeningroom\?v=|\/sandalsResorts#\w\/\w\/.*\/))([^\/&]{10,12})/)[1];
		player.player('loadVideo', { id: data.url });
		$('.youtube-player').css("margin-left","0");
	};

	$scope.deleteNote = function(id) {
		$scope.handleDeletedNoted(id);
		socket.emit('deleteNote', {id: id});
	};

	$scope.handleDeletedNoted = function(id) {
		var oldNotes = $scope.notes,
		newNotes = [];

		angular.forEach(oldNotes, function(note) {
			if(note.id !== id) newNotes.push(note);
		});

		$scope.notes = newNotes;
	}
	var videosContainer = document.getElementById('videos-container');
	var connection = new RTCMultiConnection();
	var sessions = {};
	// connection.trickleIce = false;
	// this code is used for screen-viewers only.
	// screen sender will be overriding it later.
	connection.sdpConstraints.mandatory = {
		OfferToReceiveAudio: true,
		OfferToReceiveVideo: true,
		VoiceActivityDetection: true
	};
	connection.mediaConstraints.mandatory = {
		minFrameRate: 60
	};
	connection.session = {
    screen: true,
    oneway: true
  };

  connection_file.session = {
    data: true
  };

  connection.onstream = function(e) {
		e.mediaElement.width = 600;
		videosContainer.insertBefore(e.mediaElement, videosContainer.firstChild);
		rotateVideo(e.mediaElement);
		scaleVideos();
	};
	function rotateVideo(mediaElement) {
		mediaElement.style[navigator.mozGetUserMedia ? 'transform' : '-webkit-transform'] = 'rotate(0deg)';
		setTimeout(function() {
			mediaElement.style[navigator.mozGetUserMedia ? 'transform' : '-webkit-transform'] = 'rotate(360deg)';
		}, 1000);
	}
	connection.onstreamended = function(e) {
		e.mediaElement.style.opacity = 0;
		rotateVideo(e.mediaElement);
		setTimeout(function() {
			if (e.mediaElement.parentNode) {
				e.mediaElement.parentNode.removeChild(e.mediaElement);
			}
			scaleVideos();
			connection.close();
		}, 1000);
	};

  connection.connect();
  connection_file.connect('channel');

  document.getElementById('fileInput').onchange = function() {
    var file = this.files[0];
    connection_file.send(file);
  };

  connection_file.body = document.getElementById('file-progress');
  connection_file.onopen = function(){
    document.getElementById('fileShareLi').style.display = 'block';
    document.getElementById('file-progress').innerHTML = "<span class='buttonicon buttonicon-file'></span> 을 누르시면 파일 공유가 가능합니다";
  };


  connection.onNewSession = function(session) {
		//if (sessions[session.sessionid]) return;
		sessions[session.sessionid] = session;

		var sessionid = session.sessionid;
		session = sessions[sessionid];
		if (!session) throw 'No such session exists.';
		session.join();
	};

  $('#screeShare').on('click', function() {
		connection.extra = {
			'session-name': 'redia90'
		};
		// screen sender don't need to receive any media.
		// so both media-lines must be "sendonly".
		connection.sdpConstraints.mandatory = {
			OfferToReceiveAudio: false,
			OfferToReceiveVideo: false
		};
		connection.open();
	});
		// setup signaling to search existing sessions

  function scaleVideos() {
		var videos = document.querySelectorAll('video'),
			length = videos.length,
			video;
		var minus = 130;
		var windowHeight = 300;
		var windowWidth = 200;
		var windowAspectRatio = windowWidth / windowHeight;
		var videoAspectRatio = 4 / 3;
		var blockAspectRatio;
		var tempVideoWidth = 0;
		var maxVideoWidth = 0;
		for (var i = length; i > 0; i--) {
			blockAspectRatio = i * videoAspectRatio / Math.ceil(length / i);
			if (blockAspectRatio <= windowAspectRatio) {
				tempVideoWidth = videoAspectRatio * windowHeight / Math.ceil(length / i);
			} else {
				tempVideoWidth = windowWidth / i;
			}
			if (tempVideoWidth > maxVideoWidth)
				maxVideoWidth = tempVideoWidth;
		}
		for (var i = 0; i < length; i++) {
			video = videos[i];
			if (video){
				video.width = maxVideoWidth - minus;
				video.muted = false;
			}
		}
	}
	window.onresize = scaleVideos;

  $scope.isShow=1;

});
