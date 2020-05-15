var socket = io();
let sessionId = sessionStorage.getItem('data');

function startGame() {
  var name = document.getElementById("name").value;
  socket.emit('register',name,sessionId);
}

socket.on('register error', function(msg) {
  document.getElementById("error-msg").innerHTML = msg;
});

socket.on('joining', function() {
  document.getElementById("loading").style.display = "block";
  document.getElementById("myForm").style.display = "none";
  console.log("joining ");
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
