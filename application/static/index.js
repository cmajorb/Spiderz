var socket = io();
let sessionId = sessionStorage.getItem('data');
document.getElementById("name").value = sessionStorage.getItem('name');

function startGame() {
  var name = document.getElementById("name").value;
  var gameSize = document.getElementById("gameSize").value
  sessionStorage.setItem('name', name);
  socket.emit('register',name,sessionId,gameSize);
}

socket.on('register error', function(msg) {
  document.getElementById("error-msg").innerHTML = msg;
});

socket.on('joining', function(msg) {
  document.getElementById("loading").style.display = "block";
  document.getElementById("myForm").style.display = "none";
  if(msg!==undefined) {
    document.getElementById("status").innerHTML = msg;
  }
  console.log("joining ");
});
socket.on('info', function(msg) {
  document.getElementById("info").innerHTML = msg;
});
socket.on('paired', function() {
  window.location.href = "/game";
});
socket.on("set-session-acknowledgement", function(data) {
  console.log(data);
  sessionId = data;
  sessionStorage.setItem('data', data);
});
// Get saved data from sessionStorage
console.log(sessionId);
socket.emit('start-session', sessionId);
