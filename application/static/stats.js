  var socket = io();
  socket.emit('get stats');
  socket.on('stats', function(data) {
    console.log(data);
    var element = document.getElementById("data");
    for(var i = 0; i < data.length; i++) {
      var tag = document.createElement("tr");
      element.appendChild(tag);
      for(var x = 0; x < data[i].length; x++) {
        var td = document.createElement("td");
        var text = document.createTextNode(data[i][x]);
        td.appendChild(text);
        element.appendChild(td);
      }
    }
  });
  socket.on('scoreboard', function(data) {
    console.log(data);
    var element = document.getElementById("scoreboard");
    for(var i = 0; i < data.length; i++) {
      var tag = document.createElement("tr");
      element.appendChild(tag);
      for(var x = 0; x < data[i].length; x++) {
        var td = document.createElement("td");
        var text = document.createTextNode(data[i][x]);
        td.appendChild(text);
        element.appendChild(td);
      }
    }
  });
  socket.on('summary', function(data) {
    console.log(data);
    var element = document.getElementById("summary");
    for(var i = 0; i < data.length; i++) {
      var tag = document.createElement("tr");
      element.appendChild(tag);
      for(var x = 0; x < data[i].length; x++) {
        var td = document.createElement("td");
        var text = document.createTextNode(data[i][x]);
        td.appendChild(text);
        element.appendChild(td);
      }
    }
  });
