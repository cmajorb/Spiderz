var socket = io();
var canvas = document.getElementById("myCanvas");
var ctx = canvas.getContext("2d");
var size;
var strokeStyle;
var gapSize;
var midX;
var midY;
var sections;
var randomDensity;
var tiles = [];
var spiderSize;
var centerColor;
var playerData;
var gameState;

const image = new Image();
image.src = "/static/images/spider.png";

canvas.addEventListener("click", clickEvent);
socket.emit('new player');
socket.on('state', function(gameData) {
  tiles = gameData.sTiles;
  gameState = gameData.sGameState;
  players = gameData.sPlayerData;
  centerColor = gameData.sCenterColor;
  winner = gameData.sWinner;
  drawGrid();
});

socket.on('init', function(canvasData) {
  size = canvasData.sSize;
  strokeStyle = canvasData.SstrokeStyle;
  gapSize = canvasData.sGapSize;
  midX = canvasData.sMidX;
  midY = canvasData.sMidY;
  sections = canvasData.sSections;
  randomDensity = canvasData.sRandomDensity;
  spiderSize = canvasData.sSpiderSize;
  centerColor = canvasData.sCenterColor;
  document.getElementById("restart").style.display = "none";
  console.log("init run");
});

function startGame() {
  socket.emit('start');
  document.getElementById("start").style.display = "none";
  console.log("start game");
}

function restartGame() {
  socket.emit('restart');
  document.getElementById("restart").style.display = "none";
  document.getElementById("start").style.display = "block";
  console.log("restart game");
}

function clickEvent(e) {
    var coor = getMousePos(canvas,e);
    var cursorY = midY-coor.y;
    var cursorX = midX-coor.x;
    var polar = cartesian2Polar(cursorX,cursorY);
    socket.emit('click',polar);
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

function drawGrid(){
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "black";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(midX, midY, gapSize*size, 0, Math.PI*2, false);
  ctx.fillStyle = "white";
  ctx.fill();
  ctx.closePath();

  for(var i =0; i<=size; i++) {
    ctx.beginPath();
    ctx.arc(midX, midY, gapSize*i, 0, Math.PI*2, false);
    ctx.stroke();
    ctx.closePath();
  }
  ctx.beginPath();
  for(var i=0; i<(sections/2);i++) {
    ctx.moveTo(size*gapSize*Math.cos((Math.PI/(sections/2))*i)+midX,size*gapSize*Math.sin((Math.PI/(sections/2))*i)+midY);
    ctx.lineTo(size*gapSize*Math.cos((Math.PI/(sections/2))*i+Math.PI)+midX,size*gapSize*Math.sin((Math.PI/(sections/2))*i+Math.PI)+midY);
  }
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(midX, midY, gapSize, 0, Math.PI*2, false);
  ctx.fillStyle = centerColor;
  ctx.fill();
  ctx.closePath();

  ctx.lineWidth = gapSize;
  ctx.strokeStyle = "rgba(255, 0, 0, 1)";

  for(var i = 0; i<tiles.length; i++) {
    ctx.beginPath();
    ctx.arc(midX, midY, gapSize*tiles[i][0]+gapSize/2, (Math.PI/(sections/2))*tiles[i][1], (Math.PI/(sections/2))*tiles[i][1]+(Math.PI/(sections/2)), false);
    ctx.stroke();
    ctx.closePath();
  }

  for(var i = 0;i<players.length;i++) {
    var coor = Polar2cartesian(players[i].r,players[i].angle);
    if(players[i].r==-1) {
      ctx.drawImage(image, 0+i*gapSize*spiderSize,0,gapSize*spiderSize,gapSize*spiderSize);
    }
    else {
      ctx.drawImage(image, coor.x-gapSize*(spiderSize/2),coor.y-gapSize*(spiderSize/2),gapSize*spiderSize,gapSize*spiderSize);
    }
  }

  if(gameState==1) {
    document.getElementById("restart").style.display = "block";
    ctx.fillStyle = "black";
    ctx.font = "30px Arial";
    if(winner!=-1) {
      ctx.fillText("Player "+winner+" wins", 10, 50);
    }
    else {
      ctx.fillText("No one wins :(", 10, 50);
    }
  }
}

function getMousePos(canvas, evt) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top
    };
}
