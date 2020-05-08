// Dependencies

var express = require('express');
var http = require('http');
var path = require('path');
var socketIO = require('socket.io');

var app = express();
var server = http.Server(app);
var io = socketIO(server);


app.set('port', 5000);
app.use('/static', express.static(__dirname + '/static'));

// Routing
app.get('/', function(request, response) {
  response.sendFile(path.join(__dirname, 'index.html'));
});

// Starts the server.
server.listen(5000, function() {
  console.log('Starting server on port 5000');
});


io.on('connection', function(socket) {
  socket.on('disconnect', function () {
    console.log("disconnected");
    for(var i = 0; i<players.length;i++){
      if(players[i].id == socket.id) {
        players.splice(i, 1);
      }
    }
    canvasData.sNumOfPlayers = players.length;
    io.sockets.emit('init', canvasData);

  });
  socket.on('new player', function() {
    var spider = new Spider(-1,-1,socket.id);
    players.push(spider);
    //playerData.push({id:spider.id,r:spider.r,angle:spider.angle});
    //numOfPlayers++;
    canvasData.sNumOfPlayers = players.length;

    gameData.sPlayerData = players;
    io.sockets.emit('init', canvasData);
    console.log("new player: "+socket.id + " ("+canvasData.sNumOfPlayers+")");

  });
  socket.on('start', function() {
    if(gameState == -1) {
      currentPlayer = players[0];
      gameState = 0;
      console.log("starting game");

    }
  });
  socket.on('restart', function() {
    restart();
  });
  socket.on('click', function(polar) {
    if(gameState==0) {
      if(socket.id == currentPlayer.id) {
        var currentNode = nodeSearch(currentPlayer.r,currentPlayer.angle);
        var clickNode =  nodeSearch(polar.distance,polar.radians);

        if(clickNode.active == false || clickNode === center) {
          if(currentPlayer.r==-1) {
            if(clickNode.r==size-1) {
              currentPlayer.setLocation(clickNode.r,clickNode.angle);
              nodeSearch(clickNode.r,clickNode.angle).setActive();
              updateGameState();
            }
          }
          else if(currentNode.up==clickNode || currentNode.down==clickNode || currentNode.left==clickNode || currentNode.right==clickNode) {
            currentPlayer.setLocation(clickNode.r,clickNode.angle);
            nodeSearch(clickNode.r,clickNode.angle).setActive();
            updateGameState();
          }
        }
      } else {
        console.log("not your turn");
      }
    }
    //console.log(polar+" "+socket.id);
  });

});

setInterval(function() {
  io.sockets.emit('state', gameData);
}, 10000 / 60);



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
    }
    setActive() {
      this.active = true;
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
  constructor(r,angle,id) {
    this.r = r;
    this.angle = angle;
    this.active = true;
    this.id = id;
    //nodeSearch(r,angle).setActive();
  }
  setLocation(newr, newangle) {
    var node = nodeSearch(newr,newangle);
    if(newr==0) {
      this.active = false;
      winner = this.id;
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
var tiles = [];
const head = new LinkedTile(1,0);
const center = new CenterTile();
var spiderSize = 3;
var currentPlayer;
var turnCount = 0;
var players = [];
var numOfPlayers =0;
var gameState;
var winner;
var activeTiles = [];
var playerData = [];

var canvasData = {sSize: size, sStrokeStyle: strokeStyle, sGapSize: gapSize, sMidX: midX, sMidY:midY, sSections: sections, sSpiderSize: spiderSize, srandomDensity: randomDensity, sCenterColor: center.color, sNumOfPlayers:numOfPlayers};
var gameData;
init();
function init() {
  gameState = -1;
  winner = -1;
  tiles.push(head);

  head.down = center;
  center.left = center;
  center.right = center;
  recursiveRender(head,1,0,head);
  /*
  for(var i = 0; i<numOfPlayers;i++){
    players.push(new Spider(-1,-1,i));
  }
  */
  //currentPlayer = players[0];
  for(var i = 0;i<(sections*size)*randomDensity; i++) {
    var r = (Math.floor(Math.random() * (size-1)))+1;
    var angle = Math.floor(Math.random() * sections);
    nodeSearch(r,angle).setActive();
  }

  for(var i = 0;i<tiles.length;i++) {
    if(tiles[i].active) {
      activeTiles.push([tiles[i].r,tiles[i].angle]);
    }
  }
  gameData = {sTiles: activeTiles, sGameState: gameState,sPlayerData: players, sCenterColor:center.color, sWinner:winner};
}

function restart() {
  gameState = -1;
  winner = -1;
  activeTiles = [];
  center.reset();
  for(var i =0; i<tiles.length;i++) {
    tiles[i].active = false;
  }
  for(var i = 0; i<players.length; i++) {
    players[i].reset();
  }
  for(var i = 0;i<(sections*size)*randomDensity; i++) {
    var r = (Math.floor(Math.random() * (size-1)))+1;
    var angle = Math.floor(Math.random() * sections);
    nodeSearch(r,angle).setActive();
  }

  for(var i = 0;i<tiles.length;i++) {
    if(tiles[i].active) {
      activeTiles.push([tiles[i].r,tiles[i].angle]);
    }
  }
  gameData = {sTiles: activeTiles, sGameState: gameState,sPlayerData: players, sCenterColor:center.color, sWinner:winner};
}

function checkTraps() {
  for(var i = 0;i<players.length;i++) {
    if(players[i].r>0) {
      var node = nodeSearch(players[i].r,players[i].angle);
      if(node.down.active == true && node.left.active == true && node.right.active == true) {
          if(node.up) {
            if(node.up.active == true) {
              players[i].active = false;
            }
          }
          else {
            players[i].active = false;
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

function updateGameState() {
  checkTraps();
  var c = 0;
  for(var i=0;i<tiles.length;i++) {
    if(tiles[i].active == true) {
      activeTiles.push([tiles[i].r,tiles[i].angle]);
    }
  }
  do {
    c++;
    turnCount++;
    if(c>players.length) {
      gameState = 1;
    }
    console.log(gameState+":"+winner);
  }
  while(players[turnCount%players.length].active == false && c<=players.length);

  currentPlayer = players[turnCount%players.length];
  gameData = {sTiles: activeTiles, sGameState: gameState,sPlayerData: players, sCenterColor:center.color, sWinner:winner};


}







function nodeSearch(r, angle) {
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
function recursiveRender(node,r,angle,firstNode) {
  if(angle<sections-1) {
    //console.log("creating ("+r+","+(angle+1)+")");
    var nextNode = new LinkedTile(r,angle+1);
    tiles.push(nextNode);
    nextNode.r = r;
    nextNode.angle = angle+1;
    node.left = nextNode;
    nextNode.right = node;
    nextNode.down = node.down.left;
    node.down.left.up = nextNode;
    recursiveRender(node.left,r,angle+1,firstNode);
  }
  else {
    if(r<size) {
      node.left = firstNode;
      node.left.right = node;
      if(r>=size-1) {
        return;
      }
      //console.log("creating ("+(r+1)+","+0+")");
      var nextNode = new LinkedTile(r+1,0);
      tiles.push(nextNode);
      nextNode.r = r+1;
      nextNode.angle = 0;
      nextNode.down = node.left;
      node.left.up = nextNode;
      recursiveRender(nextNode,r+1,0,nextNode);
    }
  }
}
