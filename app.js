
/**
 * Node.js Login Boilerplate
 * More Info :
 *http://kitchen.braitsch.io/building-a-login-system-in-node-js-and-mongodb/
 * Copyright (c) 2013-2016 Stephen Braitsch
 **/

var http = require('http');
var express = require('express');
var session = require('express-session');
var bodyParser = require('body-parser');
var errorHandler = require('errorhandler');
var cookieParser = require('cookie-parser');
var MongoStore = require('connect-mongo')(session);
var timesyncServer = require('timesync/server');
var stdin = process.openStdin();

var RM = require('./app/server/modules/round-manager.js');
var AM = require('./app/server/modules/account-manager.js');
var SM = require('./app/server/modules/state-manager.js');

var app = express();

app.locals.pretty = true;
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/app/server/views');
app.set('view engine', 'jade');
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended : true}));
app.use(require('stylus').middleware({src : __dirname + '/app/public'}));
app.use(express.static(__dirname + '/app/public'));

// build mongo database connection url //

var dbHost = process.env.DB_HOST || 'localhost';
var dbPort = process.env.DB_PORT || 27017;
var dbName = process.env.DB_NAME || 'node-login';

var dbURL = 'mongodb://' + dbHost + ':' + dbPort + '/' + dbName;
if (app.get('env') == 'live') {
  // prepend url with authentication credentials //
  dbURL = 'mongodb://' + process.env.DB_USER + ':' + process.env.DB_PASS +
    '@' + dbHost + ':' + dbPort + '/' + dbName;
}

app.use(session({
  secret : 'faeb4453e5d14fe6f6d04637f78077c76c73d1b4',
  proxy : true,
  resave : true,
  saveUninitialized : true,
  store : new MongoStore({url : dbURL})
}));

require('./app/server/routes')(app);

var server = http.createServer(app).listen(app.get('port'), function() {
  console.log('Express server listening on port ' + app.get('port'));
});

var io = require("socket.io")(server);

app.use('/timesync', timesyncServer.requestHandler);

console.log("Enter 1 for status and 2 for starting a round.");

function endRound() {
  RM.endRound();
  io.sockets.emit('round_end');
  console.log("*".repeat(20));
  console.log("Round end");
  console.log("*".repeat(20));
}

stdin.addListener("data", function(d) {
  var choice = d.toString().trim();
  if (choice == "1") {
    console.log("*".repeat(20));
    console.log("Round status");
    console.log("*".repeat(20));
    console.log("Live : ", RM.live);
    console.log("Index : ", RM.index);
    console.log("Time remaining : ", RM.end_time - new Date() / 1000);
    console.log("*".repeat(20));
  } else if (choice == "2") {
    RM.getCurrentRound(function(e, res) {
      if (e || res == null)
        console.log("Cannot get current round");
      else {
        console.log("*".repeat(20));
        console.log("Start round");
        console.log("*".repeat(20));
        var startData = {
          "start_time" : (new Date()).getTime(),
          "end_time" :
            (new Date()).getTime() + (1000 * res["duration"]),
          "id" : res["index"]
        };
        RM.start_time = startData['start_time'];
        RM.end_time = startData['end_time'];

        console.log(startData);

        SM.initial_state(res["index"], function(e) {
          if (e) {
            console.log("Cannot start round");
          } else {
            RM.live = true;
            RM.index = res["index"];
            io.sockets.emit("round_start");
            setTimeout(endRound, RM.end_time - RM.start_time);
          }
        });
      }
    });
  } else {
    console.log("*".repeat(20));
    console.log("Invalid input");
    console.log("*".repeat(20));
  }
});
