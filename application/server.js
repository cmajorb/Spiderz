//server variables
var express = require('express');
var http = require('http');
var path = require('path');
var socketIO = require('socket.io');
const crypto = require("crypto");

var app = express();
var server = http.Server(app);
var io = socketIO(server);
var refreshRate = 1000/2;
var activeSessions = [];
var rooms = [];
var dTime = 2; //time until user is deactivated

app.set('port', process.env.PORT);
app.use('/static', express.static(__dirname + '/static'));

// Routing
app.get('/', function(request, response) {
  var language = request.query.lang;
  if(language == 'spa') {
    response.sendFile(path.join(__dirname, 'index_spa.html'));
  } else {
    response.sendFile(path.join(__dirname, 'index.html'));
  }
});
app.get('/game', function(request, response) {
  var language = request.query.lang;
  if(language == 'spa') {
    response.sendFile(path.join(__dirname, 'game_spa.html'));
  } else {
    response.sendFile(path.join(__dirname, 'game.html'));
  }
});
app.get('/info', function(request, response) {
  var language = request.query.lang;
  if(language == 'spa') {
    response.sendFile(path.join(__dirname, 'info_spa.html'));
  } else {
    response.sendFile(path.join(__dirname, 'info.html'));
  }
});
// Starts the server.
server.listen(process.env.PORT, function() {
  console.log('Starting server on port '+process.env.PORT);
});


io.on('connection', function(socket) {
  socket.on('start-session', function(data) {
    io.sockets.emit('init', canvasData); //need to fix

            if (getSessionById(activeSessions,data) != -1) {
              var client = getSessionById(activeSessions,data);
              console.log(client.sessionId+" rejoined");
              if(client.state == 3) {
                socket.join(client.room);
              }
              client.socketId = socket.id;
              socket.emit("set-session-acknowledgement", data);
            } else {
              var session_id = crypto.randomBytes(16).toString("hex"); //generating the sessions_id and then binding that socket to that sessions
              activeSessions.push({sessionId: session_id, socketId: socket.id, state: 1});
              console.log(session_id + " joined for first time");
              socket.emit("set-session-acknowledgement", session_id);
            }
            getSessionBySocket(activeSessions,socket.id).disconnectTime = 0;

              console.log("Number of active users: "+activeSessions.length);

        });
  socket.on('disconnect', function () {
    var client = getSessionBySocket(activeSessions,socket.id);
    client.disconnectTime = Date.now();
    if(client.state!==3) {
      client.state = 1;
    }
    console.log(client.sessionId+ " has disconnected");

    //getSessionById(activeSessions,socket.id,"socketId").state = 0;
    //io.sockets.emit('init', canvasData);

  });
  socket.on('register', function(name,data) {
    if(name) {
      console.log(data+" changed name to "+name);
      var client = getSessionById(activeSessions,data)
      client.name = name;
      client.state = 2;
      socket.emit('joining');
    }
    else {
      console.log("Naming error");
      var msg = "Name cannot be blank";
      socket.emit('register error', msg);
    }
  });
  socket.on('player connect', function(data) {
    //verify the user
    var room = getRoomData(data);
    var client = getSessionById(activeSessions,data);

    if(room != -1 && client.state == 3) {
      var game = room.gameData;
      var sendInfo = {
        sActiveTiles: game.sActiveTiles,
        sGameState: game.sGameState,
        sPlayerData: game.sPlayerData,
        sCenterColor:game.sCenter.color,
        sWinner:game.sWinner,
      };
      socket.emit('state', sendInfo);
    }
    else {
      socket.emit('redirect');
    }
  });

  socket.on('click', function(polar,data) {
    var room = getRoomData(data);
    var game = room.gameData;

    if(game.sGameState==0) {
      if(data == game.sCurrentPlayer.id) {
        var currentNode = nodeSearch(game.sCurrentPlayer.r,game.sCurrentPlayer.angle,game.sHead);
        var clickNode =  nodeSearch(polar.distance,polar.radians,game.sHead);
        if(clickNode.active == false || clickNode === center) {
          if(game.sCurrentPlayer.r==-1) {
            if(clickNode.r==size-1) {
              game.sCurrentPlayer.setLocation(clickNode.r,clickNode.angle,game);
              nodeSearch(clickNode.r,clickNode.angle,game.sHead).setActive(colors[game.sPlayerData.indexOf(game.sCurrentPlayer)]);
              updateGameState(room);
            }
          }
          else if(currentNode.up==clickNode || currentNode.down==clickNode || currentNode.left==clickNode || currentNode.right==clickNode) {
            game.sCurrentPlayer.setLocation(clickNode.r,clickNode.angle,game);
            nodeSearch(clickNode.r,clickNode.angle,game.sHead).setActive(colors[game.sPlayerData.indexOf(game.sCurrentPlayer)]);
            updateGameState(room);
          }
        }
      } else {
        console.log(socket.id + " clicked");
      }
      var sendInfo = {
        sActiveTiles: game.sActiveTiles,
        sGameState: game.sGameState,
        sPlayerData: game.sPlayerData,
        sCenterColor:game.sCenter.color,
        sWinner:game.sWinner,
      };
      io.to(room.roomId).emit('state', sendInfo);

    }
  });
});

setInterval(function() {
  var waitRoom = [];
  for(var i = 0; i<activeSessions.length; i++) {
    if(activeSessions[i].state == 2) {
      io.to(activeSessions[i].socketId).emit('joining');
      waitRoom.push(activeSessions[i]);
    }
    else if (activeSessions[i].state == 1) {
      var msg = activeSessions.length + " active players";
      io.to(activeSessions[i].socketId).emit('info',msg);
    }
    if(activeSessions[i].disconnectTime != 0 && (Date.now()-activeSessions[i].disconnectTime)/1000 > dTime) {
          endGame(activeSessions[i].room,activeSessions[i].name,0);
          console.log(activeSessions[i].name + " has been deactivated");
          activeSessions.splice(i, 1);

    }
  }
  if(waitRoom.length>1) {
    var player1 = waitRoom.pop();
    var player2 = waitRoom.pop();
    createRoom(player1,player2);
  }

}, refreshRate);



class LinkedTile {
    constructor(r,angle) {
        this.r = r;
        this.angle = angle;
        this.active = false;
        this.up = null;
        this.down = null;
        this.left = null;
        this.right = null;
        this.explored = false;
        this.trapped = true;
        this.color = neutral;
    }
    setActive(color) {
      this.active = true;
      this.color = color;
    }
}
class CenterTile {
  constructor() {
    this.r = 0;
    this.angle = 0;
    this.active = false;
    this.left = null;
    this.right = null;
    this.up = null;
    this.down = null;
    this.color = "green";
  }
  setActive() {
    //this.active = true;
    this.color = "blue";
  }
  reset() {
    this.active = false;
    this.color = "green";
  }
}
class Spider {
  constructor(r,angle,id,name) {
    this.r = r;
    this.angle = angle;
    this.active = true;
    this.id = id;
    this.activeTurn = false;
    this.name = name;
  }
  setLocation(newr, newangle,game) {
    var node = nodeSearch(newr,newangle,game.sHead);
    if(newr==0) {
      this.active = false;
      game.sWinner = this.name;
    }
    this.r = newr;
    this.angle = newangle;
  }
  reset() {
    this.r = -1;
    this.angle = -1;
    this.active = true;
  }
}


var size = 10;
var strokeStyle = "rgba(0, 0, 0, 1)";
var gapSize = 30;
var midX = 350;
var midY = 350;
var sections = 10;
var randomDensity = 0.2;
var spiderSize = 3;

var neutral = "rgba(192, 192, 192, 1)";
var colors = ["rgba(255, 0, 0, 1)","rgba(0, 0, 255, 1)","rgba(255, 255, 0, 1)"];

var canvasData = {
  sSize: size,
  sStrokeStyle: strokeStyle,
  sGapSize: gapSize,
  sMidX: midX,
  sMidY:midY,
  sSections: sections,
  sSpiderSize: spiderSize,
  srandomDensity: randomDensity
  //sCenterColor: center.color
};
var gameData;

function createRoom(player1, player2) {
  var room_id = crypto.randomBytes(16).toString("hex");

  var spider1 = new Spider(-1,-1,player1.sessionId,player1.name);
  var spider2 = new Spider(-1,-1,player2.sessionId,player2.name);
  var gamePlayers = [];
  gamePlayers.push(spider1);
  gamePlayers.push(spider2);

  player1.state = 3;
  player2.state = 3;
  player1.room = room_id;
  player2.room = room_id;

  init(room_id,gamePlayers);
  io.to(player1.socketId).emit('paired');
  io.to(player2.socketId).emit('paired');
  io.sockets.emit('init', canvasData);
  console.log("active rooms: " + rooms.length);

}
function endGame(room,name,reason) {
  var message;
  if(reason == 0) {
    message = name + " has left the game";
  }else if(reason == 1) {
    message = "The winner is " + name;
  }
  for(var i = 0; i<activeSessions.length; i++){
    if(activeSessions[i].room == room) {
      activeSessions[i].state = 1;
    }
  }
  io.to(room).emit('end game', message);
  removeRoom(room);
  console.log("active rooms: " + rooms.length);
}
function removeRoom(id) {
  for(var i = 0; i<rooms.length; i++){
    if(rooms[i].roomId == id) {
      rooms.splice(i, 1);
      return;
    }
  }
}
function getRoomData(id) {
  var client = getSessionById(activeSessions,id)
  for(var i = 0; i<rooms.length; i++){
    if(rooms[i].roomId == client.room) {
      return rooms[i];
    }
  }
  return -1;
}
function getSessionById(array, key) {
    for(var i = 0; i<array.length;i++){
      if(array[i].sessionId == key) {
        return array[i];
      }
    }
  return -1;
}
function getSessionBySocket(array, key) {
    for(var i = 0; i<array.length;i++){
      if(array[i].socketId == key) {
        return array[i];
      }
    }
  return -1;
}

function randomGenerate(newTiles,newActiveTiles,sHead) {
  //randomly fill tiles
  for(var i = 0;i<(sections*size)*randomDensity; i++) {
    var r = (Math.floor(Math.random() * (size-1)))+1;
    var angle = Math.floor(Math.random() * sections);
    nodeSearch(r,angle,sHead).setActive(neutral);
  }

  //push active tile info to the array
  for(var i = 0;i<newTiles.length;i++) {
    if(newTiles[i].active) {
      newActiveTiles.push([newTiles[i].r,newTiles[i].angle,newTiles[i].color]);
    }
  }

}

function init(room_id, gamePlayers) {
  head = new LinkedTile(1,0);
  center = new CenterTile();
  gameState = -1;
  winner = -1;
  var newTiles = [];
  var newActiveTiles = [];
  newTiles.push(head);

  head.down = center;
  center.left = center;
  center.right = center;
  recursiveRender(head,1,0,head,newTiles);
  randomGenerate(newTiles,newActiveTiles,head);
  var currentPlayer = gamePlayers[0];
  currentPlayer.activeTurn = true;
  gameData = {
    sActiveTiles: newActiveTiles,
    sGameState: 0,
    sPlayerData: gamePlayers,
    sCenterColor:center.color,
    sWinner:winner,
    sTiles:newTiles,
    sHead: head,
    sTurnCount: 0,
    sCenter: center,
    sCurrentPlayer: currentPlayer
  };
  rooms.push({
    roomId: room_id,
    gameData: gameData
  });
}



//checks if player is trapped and deactivates them if so
function checkTraps(game) {
  for(var i = 0;i<game.sPlayerData.length;i++) {
    if(game.sPlayerData[i].r>0) {
      var node = nodeSearch(game.sPlayerData[i].r,game.sPlayerData[i].angle,game.sHead);
      if(node.down.active == true && node.left.active == true && node.right.active == true) {
          if(node.up) {
            if(node.up.active == true) {
              game.sPlayerData[i].active = false;
            }
          }
          else {
            game.sPlayerData[i].active = false;
          }
      }
    }
  }
}
function trapCheck(node) {
  node.explored = true;
  //console.log("exploring "+node.r+","+node.angle);
    if(node.left.explored == false && node.left.active == false) {
      node.left.trapped = false;
      trapCheck(node.left);
    }
    if(node.right.explored == false && node.right.active == false) {
      node.right.trapped = false;
      trapCheck(node.right);
    }
    if(node.down !== center && node.down.explored == false && node.down.active == false) {
      node.down.trapped = false;
      trapCheck(node.down);
    }
    if(node.up && node.up.explored == false && node.up.active == false) {
      node.up.trapped = false;
      trapCheck(node.up);
    }
}

function updateGameState(room) {
  var game = room.gameData;
  checkTraps(game);
  for(var i=0;i<game.sTiles.length;i++) {
    if(game.sTiles[i].active == true) {
      game.sActiveTiles.push([game.sTiles[i].r,game.sTiles[i].angle,game.sTiles[i].color]);
    }
  }
  var c = 0;
  do {
    c++;
    game.sTurnCount++;
    if(c>game.sPlayerData.length) {
      game.sGameState = 1;
      endGame(room.roomId,game.sWinner,1)
    }
  }
  while(game.sPlayerData[game.sTurnCount%game.sPlayerData.length].active == false && c<=game.sPlayerData.length);
  game.sCurrentPlayer.activeTurn = false;
  game.sCurrentPlayer = game.sPlayerData[game.sTurnCount%game.sPlayerData.length];
  game.sCurrentPlayer.activeTurn = true;
}



function nodeSearch(r, angle, head) {
  if(r==0) {
    return center;
  }
  var currentNode = head;
  if(r>=size || angle>sections-1 || angle < 0) {
    return -1;
  }
  while(currentNode.r<r) {
    currentNode = currentNode.up;
  }
  while(currentNode.angle!==angle) {
      currentNode = currentNode.left;
  }
  return currentNode;
}
function recursiveRender(node,r,angle,firstNode,newTiles) {
  if(angle<sections-1) {
    var nextNode = new LinkedTile(r,angle+1);
    newTiles.push(nextNode);
    nextNode.r = r;
    nextNode.angle = angle+1;
    node.left = nextNode;
    nextNode.right = node;
    nextNode.down = node.down.left;
    node.down.left.up = nextNode;
    recursiveRender(node.left,r,angle+1,firstNode,newTiles);
  }
  else {
    if(r<size) {
      node.left = firstNode;
      node.left.right = node;
      if(r>=size-1) {
        return;
      }
      var nextNode = new LinkedTile(r+1,0);
      newTiles.push(nextNode);
      nextNode.r = r+1;
      nextNode.angle = 0;
      nextNode.down = node.left;
      node.left.up = nextNode;
      recursiveRender(nextNode,r+1,0,nextNode,newTiles);
    }
  }
}
