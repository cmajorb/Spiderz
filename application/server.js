//server variables
var express = require('express');
var http = require('http');
var path = require('path');
var socketIO = require('socket.io');
const crypto = require("crypto");
var mysqlx = require('@mysql/xdevapi');

var app = express();
var server = http.Server(app);
var io = socketIO(server);
var refreshRate = 1000/2;
var activeSessions = [];
var rooms = [];
var dTime = 2; //time until user is deactivated
var wTime = 3;

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
app.get('/stats', function(request, response) {
    response.sendFile(path.join(__dirname, 'stats.html'));
});
// Starts the server.
server.listen(process.env.PORT, function() {
  console.log('Starting server on port '+process.env.PORT);
});

function tester() {
  activeSessions[0].name = "major";
  activeSessions.push({sessionId: activeSessions[0].sessionId, socketId: 000, state: 1, name: "computer"});
  activeSessions.push({sessionId: activeSessions[0].sessionId, socketId: 001, state: 1, name: "computer2"});
  activeSessions.push({sessionId: activeSessions[0].sessionId, socketId: 002, state: 1, name: "computer3"});
  createRoom([activeSessions[0].socketId,000,001,002]);

}


io.on('connection', function(socket) {
  socket.on('start-session', function(data) {
            if (getSessionById(activeSessions,data) != -1) {
              var client = getSessionById(activeSessions,data);
              console.log(client.sessionId+" rejoined");
              if(client.state == 3) {
                socket.join(client.room);
                var room = getRoomData(client.sessionId);
                io.to(client.room).emit('init', room.canvasData);
              } else {
                socket.join("mainRoom");
              }
              client.socketId = socket.id;
              socket.emit("set-session-acknowledgement", data);
            } else {
              var session_id = crypto.randomBytes(16).toString("hex"); //generating the sessions_id and then binding that socket to that sessions
              activeSessions.push({sessionId: session_id, socketId: socket.id, state: 1, ip: socket.handshake.address});
              console.log(session_id + " joined for first time");
              socket.emit("set-session-acknowledgement", session_id);
              socket.join("mainRoom");
            }
            getSessionBySocket(activeSessions,socket.id).disconnectTime = 0;
            console.log("Number of active users: "+activeSessions.length);
            //socket.join(123);
            //tester();

        });
  socket.on('disconnect', function () {
    var client = getSessionBySocket(activeSessions,socket.id);
    client.disconnectTime = Date.now();
    if(client.state!==3) {
      client.state = 1;
    }
    console.log(client.sessionId+ " has disconnected");

  });
  socket.on('click', function(polar,data) {
    var room = getRoomData(data);
    var game = room.gameData;
    if(game) {
      var currentNode = game.sCurrentPlayer.position;
      var clickNode =  nodeId(polar.distance,polar.radians,room.canvasData.sSize,room.canvasData.sSections);
      if(data == game.sCurrentPlayer.id) {
        if(checkAdjacent(currentNode,clickNode,game.sEdges)) {
          room.statsData.turns[game.sCurrentPlayer.number]++;
          game.sCurrentPlayer.position = clickNode;
          game.sEdges = removeEdge(clickNode,game.sEdges);
          game.sNodes.push([clickNode,colors[game.sCurrentPlayer.number]]);
          if(clickNode == 999) {
            room.statsData.winners.push(game.sCurrentPlayer.number)
            game.sWinner = game.sCurrentPlayer.name;
          }
          updateGameState(room);
          var validNodes = getValidMoves(game.sCurrentPlayer.position,game.sEdges);
          var sendInfo = {
            sGameState: game.sGameState,
            sPlayerData: game.sPlayerData,
            sNodes: game.sNodes.concat(validNodes),
            sWinner:game.sWinner
          };
          io.to(room.roomId).emit('state', sendInfo);
        }
      } else {
        console.log(socket.id + " clicked");
      }
    }
  });
  socket.on('register', function(name,data,gameSize) {
    if(name) {
      console.log(data+" changed name to "+name);
      var client = getSessionById(activeSessions,data)
      client.name = name;
      client.state = 2;
      client.waitTime = Date.now();
      client.gameSize = gameSize;
      socket.join("waitRoom"+gameSize);
      socket.emit('joining');

    }
    else {
      console.log("Naming error");
      var msg = "Name cannot be blank";
      socket.emit('register error', msg);
    }
  });
  socket.on('get stats', function(data) {
    var result;
    mysqlx
      .getSession({
        user: 'root',
        password: 'root',
        host: 'db',
        port: '33060'
      }).then(function (s) {
          session = s;
          return session.getSchema('mysql');
      }).then(function () {
        return session
          .sql("SELECT "+
          "TIMEDIFF(End_Time,Start_Time), "+
          "Player1_Name, "+
          "Player1_moves,"+
          "COALESCE(Player2_Name,''), "+
          "COALESCE(Player2_moves,''), "+
          "COALESCE(Player3_Name,''), "+
          "COALESCE(Player3_moves,''), "+
          "COALESCE(Player4_Name,''), "+
          "COALESCE(Player4_moves,''), "+
          "COALESCE(Place_1,''), "+
          "COALESCE(Place_2,''), "+
          "COALESCE(Place_3,''), "+
          "COALESCE(Place_4,'') "+
          "FROM mysql.Stats "+
          "ORDER BY Start_Time DESC "+
          "LIMIT 10;")
          .execute()
      }).then(function (result) {
        var data = result.fetchAll();
        socket.emit('stats',data);
      }).then(function () {
        return session
          .sql("SELECT "+
                "CASE WHEN Place_1 = 1 THEN Player1_name "+
                "WHEN Place_1 = 2 THEN Player2_name "+
                "WHEN Place_1 = 3 THEN Player3_name "+
                "WHEN Place_1 = 4 THEN Player4_name END AS Name,"+
                "COUNT(*) AS Wins "+
                "FROM mysql.Stats "+
                "WHERE Place_1 IS NOT NULL "+
                "GROUP BY "+
                "CASE WHEN Place_1 = 1 THEN Player1_name "+
                "WHEN Place_1 = 2 THEN Player2_name "+
                "WHEN Place_1 = 3 THEN Player3_name "+
                "WHEN Place_1 = 4 THEN Player4_name END "+
                "ORDER BY COUNT(*) DESC "+
                "LIMIT 10;")
          .execute()
      }).then(function (result) {
        var data = result.fetchAll();
        socket.emit('scoreboard',data);
      }).then(function () {
        return session
          .sql("SELECT "+
                "COALESCE(ROUND(SUM(CASE WHEN ISNULL(Place_1) AND ISNULL(Place_2) THEN 1 END)/COUNT(*),2),0) AS Draw, "+
                "COALESCE(ROUND(SUM(CASE WHEN Place_1 = 1 THEN 1 END)/COUNT(*),2),0) AS Wins_1, "+
                "COALESCE(ROUND(SUM(CASE WHEN Place_1 = 2 THEN 1 END) /COUNT(*),2),0) AS Wins_2, "+
                "SEC_TO_TIME(AVG(TIMEDIFF(End_Time,Start_Time))) AS AverageTime, "+
                "COUNT(*) AS Total "+
                "FROM mysql.Stats "+
                "WHERE "+
                "Player3_name IS NULL AND Player4_name IS NULL;")
          .execute()
      }).then(function (result) {
        var data = result.fetchAll();
        socket.emit('summary',data);
      });
  });
  socket.on('player connect', function(data) {
    //verify the user
    var room = getRoomData(data);
    var client = getSessionById(activeSessions,data);

    if(room != -1 && client.state == 3) {
      var game = room.gameData;
      var validNodes = getValidMoves(game.sCurrentPlayer.position,game.sEdges);
      var sendInfo = {
        sNodes: game.sNodes.concat(validNodes),
        sGameState: game.sGameState,
        sPlayerData: game.sPlayerData,
        sWinner:game.sWinner,
      };
      socket.emit('state', sendInfo);
    }
    else {
      socket.emit('redirect');
    }
  });
});

setInterval(function() {
  var waitRooms = [];
  var room;
  for(var i =2; i<=4; i++) {
    room = io.sockets.adapter.rooms['waitRoom'+i];
    if(room) {
      io.to('waitRoom'+i).emit('joining','Joining game ('+room.length+'/'+i+' players)');
      if(room.length>=i) {
        var waitRoom = [];
        for (var clientId in room.sockets ) {
            waitRoom.push(clientId);
        }
        var p = [];
        for(var x = 0;x<i;x++) {
          p.push(waitRoom.pop());
        }
        createRoom(p);
      }
    }
  }
  var mainRoom = io.sockets.adapter.rooms['mainRoom'];
  if(mainRoom) {
    var msg = mainRoom.length + " active players";
    io.to('mainRoom').emit('info',msg);
  }

  for(var i = 0; i<activeSessions.length; i++) {
    if(activeSessions[i].disconnectTime != 0 && (Date.now()-activeSessions[i].disconnectTime)/1000 > dTime) {
          if(activeSessions[i].room) {
            endGame(activeSessions[i].room,activeSessions[i].name,0);
          }
          console.log(activeSessions[i].name + " has been deactivated");
          activeSessions.splice(i, 1);
    }
  }

}, refreshRate);

class Spider {
  constructor(id,name,number) {
    this.position = -1;
    this.id = id;
    this.activeTurn = false;
    this.name = name;
    this.isTrapped = false;
    this.number = number;
  }
}

var canvasSizes = [[10,9,30],[12,11,25],[14,13,25]];

var neutral = "#c0c0c0";
var colors = ["#FF0000","#0000FF","#FFFF00","#00FF00"];
var validColor = "#e0bfff";


function createRoom(p) {
  var room_id = crypto.randomBytes(16).toString("hex");
  //var room_id = 123;
  var gamePlayers = [];

  for(var i = 0;i<p.length;i++) {
    player1 = getSessionBySocket(activeSessions,p[i]);
    player1.state = 3;
    player1.room = room_id;
    var spider1 = new Spider(player1.sessionId,player1.name,i);
    gamePlayers.push(spider1);
    io.to(p[i]).emit('paired');
  }

  var canvasData = {
    sRandomDensity: 0.25,
    sSections: canvasSizes[p.length-2][0],
    sSize: canvasSizes[p.length-2][1],
    sGapSize: canvasSizes[p.length-2][2],
    sSpiderSize: canvasSizes[p.length-2][2]/10
  };
  init(room_id,gamePlayers,canvasData);

  console.log("active rooms: " + rooms.length);

}
function endGame(roomId,name,reason) {
  var message;
  if(reason == 0) {
    message = name + " has left the game";
  }else if(reason == 1) {
    if(name==-1) {
      message = "No one wins :(";
    } else {
      message = "The winner is " + name;
    }
    postStats(roomId);
  }
  for(var i = 0; i<activeSessions.length; i++){
    if(activeSessions[i].room == roomId) {
      activeSessions[i].state = 1;
    }
  }
  removeRoom(roomId);
  io.to(roomId).emit('end game', message);
  console.log("active rooms: " + rooms.length);
}
function postStats(roomId) {
  var room = getRoomById(roomId);
  var stats = room.statsData;
  console.log("logging stats");
  var data = [stats.startTime, new Date().toISOString().slice(0, 19).replace('T', ' ')]
  var query = ['Start_Time','End_Time'];

  for(var i = 0; i < room.gameData.sPlayerData.length; i++) {
      var player = getSessionById(activeSessions,room.gameData.sPlayerData[i].id);
      data.push(player.name,player.ip,stats.turns[i]);
      query.push('Player'+(i+1)+'_Name','Player'+(i+1)+'_ip','Player'+(i+1)+'_moves');
  }
  var x = 1;
  for(var i = stats.winners.length - 1; i >= 0; i--) {
      data.push(stats.winners[i]+1);
      query.push('Place_'+x);
      x++;
  }

  mysqlx
    .getSession({
      user: 'root',
      password: 'root',
      host: 'db',
      port: '33060'
    }).then(function (session) {
      myTable = session.getSchema('mysql').getTable('Stats');
      return myTable
        .insert(query)
        .values(data)
        .execute()
    });
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
function getRoomById(id) {
  for(var i = 0; i<rooms.length; i++){
    if(rooms[i].roomId == id) {
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
function sortFunction(a, b) {
    if (a[0] === b[0]) {
        return 0;
    }
    else {
        return (a[0] < b[0]) ? -1 : 1;
    }
}
function testMap(sections,rings,newedges,numPlayers,allShortPaths) {
  validPaths = 0;
  var shortPath;
  for(var i = (sections*rings)-1; i>=(sections*rings)-sections; i--) {
      shortPath = shortestPath(i,999,sections*rings,newedges);
      if(shortPath!=-1) {
        allShortPaths.push(shortPath);
        validPaths++;
      }
  }
  if(validPaths>0) {
    return true;
  } else {
    return false;
  }
}
function randomGenerate(sections,rings,randomDensity,edges,numPlayer) {
  //randomly fill tiles
  var isValid = false;
  while(!isValid) {
    var originalEdges = [...edges];
    var nodesList = [];
    for(var i = 0;i<(sections*rings)*randomDensity; i++) {
      var randomNode = Math.floor(Math.random() * sections * rings);
      nodesList.push([randomNode,neutral]);
      originalEdges = removeAllEdges(randomNode,originalEdges);
      newedges = [...originalEdges];
    }
    var bestPathLengths = [];
    for(var i = 0;i<numPlayer;i++) {
      var allShortPaths = [];
      isValid = testMap(sections,rings,newedges,2,allShortPaths);
      if(isValid) {
        var bestPath = allShortPaths.sort(sortFunction)[0];
        bestPathLengths.push(bestPath.length);
        while(bestPath[1].length > 0) {
          removeAllEdges(bestPath[1].pop(),newedges);
        }
        if(bestPathLengths[i]>bestPathLengths[0]+1) {
               isValid = false;
        }
      } else {
        break;
      }
    }
  }
  return [nodesList,originalEdges];
}
function removeAllEdges(key,edges){
  for(var i = edges.length-1; i>=0; i--) {
    if(edges[i][0]==key || edges[i][1]==key) {
      edges.splice(i,1);
    }
  }
  return edges;
}
function removeEdge(key,edges){
  if(key==999) {
    return edges;
  }
  for(var i = edges.length-1; i>=0; i--) {
    if(edges[i][0]==key) {
      edges.splice(i,1);
    }
  }
  return edges;
}

function checkAdjacent(fromNode,toNode,edges) {
  for(var i = 0; i<edges.length; i++) {
    if(edges[i][0]==toNode && edges[i][1]==fromNode) {
      return true;
    }
  }
  return false;
}
function init(room_id, gamePlayers,canvasData) {
  gameState = -1;
  winner = -1;
  var edges = linearRender(canvasData.sSections,canvasData.sSize)
  var newNodes = randomGenerate(canvasData.sSections,canvasData.sSize,canvasData.sRandomDensity,edges,gamePlayers.length);
  var nodes = newNodes[0];
  edges = newNodes[1];

  var currentPlayer = gamePlayers[0];
  currentPlayer.activeTurn = true;
  statsData = {
    startTime: new Date().toISOString().slice(0, 19).replace('T', ' '),
    turnCount: 0,
    winners: [],
    turns: [0,0,0,0]
  }
  gameData = {
    sNodes: nodes,
    sEdges: edges,
    sValidTiles: [],
    sGameState: 0,
    sPlayerData: gamePlayers,
    sWinner:winner,
    sTurnCount: 0,
    sCurrentPlayer: currentPlayer
  };
  rooms.push({
    roomId: room_id,
    gameData: gameData,
    canvasData: canvasData,
    statsData: statsData
  });
  io.to(room_id).emit('init', canvasData); //look into this

}

function isTrapped(position,edges) {
  for(var i = 0; i<edges.length; i++) {
    if(edges[i][1]==position) {
      return false;
    }
  }
  return true;
}
function getValidMoves(position,edges) {
  var nodes = [];
  for(var i = 0; i<edges.length; i++) {
    if(edges[i][1]==position) {
      nodes.push([edges[i][0],validColor]);
    }
  }
  return nodes;
}
//checks if player is trapped and deactivates them if so
function checkTraps(room) {
  var game = room.gameData;
  for(var i = 0;i<game.sPlayerData.length;i++) {
    game.sPlayerData[i].isTrapped = isTrapped(game.sPlayerData[i].position,game.sEdges);
  }
}

function updateGameState(room) {
  var game = room.gameData;
  checkTraps(room);
  var c = 0;
  do {
    c++;
    game.sTurnCount++;
    if(c>game.sPlayerData.length) {
      game.sGameState = 1;
      endGame(room.roomId,game.sWinner,1)
      return;
    }
  }
  while(game.sPlayerData[game.sTurnCount%game.sPlayerData.length].isTrapped == true && c<=game.sPlayerData.length);

  room.statsData.turnCount++;
  game.sCurrentPlayer.activeTurn = false;
  game.sCurrentPlayer = game.sPlayerData[game.sTurnCount%game.sPlayerData.length];
  game.sCurrentPlayer.activeTurn = true;
}

function nodeId(r,t,rings,sections) {
  var id = ((r-1)*(rings+1)+t);
  if(r == 0) {
    return 999;
  }
  if(r > rings) {
    return -1;
  } else {
    return id;
  }
}

function linearRender(sections,rings) {
  var edges = [];
  var currentIndex;
  for(var r = 0; r < rings; r++) {
    for(var t = 0; t < sections; t++) {
      currentIndex = (r*sections)+t;
      if(t==sections-1) {
        edges.push([currentIndex,currentIndex-(sections-1)]); //right
      } else {
        edges.push([currentIndex,currentIndex+1]); //right
      }
      if(t==0) {
        edges.push([currentIndex,currentIndex+(sections-1)]); //left
      } else {
        edges.push([currentIndex,currentIndex-1]); //left
      }
      if(r==0){
        edges.push([999,currentIndex]); //down
      } else {
        edges.push([currentIndex,currentIndex-sections]); //down
      }
      if(r==rings-1) {
        edges.push([currentIndex,-1]); //up
      } else {
        edges.push([currentIndex,currentIndex+sections]); //up
      }
    }
  }
  return edges;

}

function shortestPath(src,dest,numVertices,edges) {
  var queue = [];
  var visited = [];
  var pred = [];
  var dist = [];
  var path = [];
  for (var i = 0; i < numVertices; i++) {
        visited.push(false);
        dist.push(9999);
        pred.push(-1);
  }
  visited[src] = true;
  dist[src] = 0;
  queue.push(src);

  while (queue.length != 0) {
        var u = queue.shift();
        for (var i = 0; i < edges.length; i++) {
          if(edges[i][1] == u) {
            if(edges[i][0] == 999) {
              path.push(u);
              var crawl = edges[i][1];
              while (pred[crawl] != -1) {
                path.push(pred[crawl]);
                crawl = pred[crawl];
              }
              return [dist[edges[i][1]] + 1,path];
            }
            else if(visited[edges[i][0]] == false) {
                visited[edges[i][0]] = true;
                dist[edges[i][0]] = dist[u] + 1;
                pred[edges[i][0]] = u;
                queue.push(edges[i][0]);
            }

          }
        }
    }
    return -1;
}
