var socket = io();
var canvas = document.getElementById("myCanvas");
var ctx = canvas.getContext("2d");
var size;
var gapSize;
var midX = 350;
var midY = 350;
var sections;
var randomDensity;
var tiles = [];
var spiderSize;
var centerColor;
var playerData;
var gameState;

const spider = new Image();
const spiderSelected = new Image();
let sessionId = sessionStorage.getItem('data');

spider.src = "/static/images/spider.png";
spiderSelected.src = "/static/images/spider_selected.png";

canvas.addEventListener("click", clickEvent);
  console.log(sessionId);
  socket.emit('start-session', sessionId);
  socket.emit('player connect',sessionId);
  socket.on('redirect', function() {
  returnHome();
  console.log("redirect");
});
socket.on('state', function(gameData) {
  tiles = gameData.sNodes;
  gameState = gameData.sGameState;
  players = gameData.sPlayerData;
  winner = gameData.sWinner;
  drawGrid();
});
socket.on('player disconnect', function(name) {
  console.log(name +" has left the game");
});
socket.on('init', function(canvasData) {
  size = canvasData.sSize;
  gapSize = canvasData.sGapSize;
  sections = canvasData.sSections;
  randomDensity = canvasData.sRandomDensity;
  spiderSize = canvasData.sSpiderSize;
  console.log("init run");
});

socket.on("set-session-acknowledgement", function(data) {
  sessionId = data;
  sessionStorage.setItem('data', data);
});

socket.on("end game", function(message) {
  document.getElementById("modal-body").innerHTML = message;
  $("#notificationModal").modal();
});

function returnHome() {
  window.location.href = "/";
}

function clickEvent(e) {
    var coor = getMousePos(canvas,e);
    var cursorY = midY-coor.y;
    var cursorX = midX-coor.x;
    var polar = cartesian2Polar(cursorX,cursorY);
    socket.emit('click',polar,sessionId);
  }

function cartesian2Polar(x,y){
    distance = Math.floor(Math.sqrt(x*x + y*y)/gapSize);
    radians = Math.floor(((Math.atan2(y,x)+Math.PI)/Math.PI)*(sections/2)); //This takes y first
    polarCoor = { distance:distance, radians:radians }
    return polarCoor
}

function Polar2cartesian(r,angle){
    angle = angle+0.5;
    r = r+0.5;
    var x = r*gapSize*Math.cos((Math.PI/(sections/2))*angle)+midX;
    var y = r*gapSize*Math.sin((Math.PI/(sections/2))*angle)+midY;
    cartesianCoor = { x:x, y:y }
    return cartesianCoor
}
function id2Cartesian(id) {
  if(id==999) {
    return(Polar2cartesian(0,0));
  }
  var r = Math.floor((id-1)/sections)+1;
  var t = (id-1)%sections;
  return Polar2cartesian(r,t);
}

function drawGrid(){
  var rings = size+1;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "black";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(midX, midY, gapSize*rings, 0, Math.PI*2, false);
  ctx.fillStyle = "white";
  ctx.fill();
  ctx.closePath();

  for(var i =0; i<=rings; i++) {
    ctx.beginPath();
    ctx.arc(midX, midY, gapSize*i, 0, Math.PI*2, false);
    ctx.stroke();
    ctx.closePath();
  }
  ctx.beginPath();
  for(var i=0; i<(sections/2);i++) {
    ctx.moveTo(rings*gapSize*Math.cos((Math.PI/(sections/2))*i)+midX,rings*gapSize*Math.sin((Math.PI/(sections/2))*i)+midY);
    ctx.lineTo(rings*gapSize*Math.cos((Math.PI/(sections/2))*i+Math.PI)+midX,rings*gapSize*Math.sin((Math.PI/(sections/2))*i+Math.PI)+midY);
  }
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(midX, midY, gapSize, 0, Math.PI*2, false);
  ctx.fillStyle = 'green';
  ctx.fill();
  ctx.closePath();

  for(var i = 0; i<tiles.length; i++) {
    if(tiles[i][0]==999) {
      ctx.beginPath();
      ctx.arc(midX, midY, gapSize, 0, Math.PI*2, false);
      ctx.lineWidth = 8;
      ctx.strokeStyle = tiles[i][1];
      ctx.stroke();
      ctx.closePath();
    }
    var r = Math.floor((tiles[i][0]-1)/sections)+1;
    var t = (tiles[i][0]-1)%sections;
    ctx.strokeStyle = tiles[i][1];
    ctx.lineWidth = gapSize;
    ctx.beginPath();
    ctx.arc(midX, midY, gapSize*r+gapSize/2, (Math.PI/(sections/2))*t, (Math.PI/(sections/2))*t+(Math.PI/(sections/2)), false);
    ctx.stroke();
    ctx.closePath();
  }

  for(var i = 0;i<players.length;i++) {
    var image = spider;
    if(players[i].activeTurn == true) {
      image = spiderSelected;
    }
    var coor = id2Cartesian(players[i].position);
    var position = [coor.x-gapSize*(spiderSize/2),coor.y-gapSize*(spiderSize/2),gapSize*spiderSize,gapSize*spiderSize];
    if(players[i].position==0) {
      position = [0+i*gapSize*spiderSize,0,gapSize*spiderSize,gapSize*spiderSize];
    }
    ctx.drawImage(image, position[0],position[1],position[2],position[3]);
    ctx.textAlign = "center";
    ctx.fillStyle = "black";
    ctx.font = "12px Arial";
    ctx.fillText(players[i].name, position[0]+(gapSize*spiderSize)/2,position[1]+(gapSize*spiderSize*0.85));
  }
}

function getMousePos(canvas, evt) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top
    };
}
