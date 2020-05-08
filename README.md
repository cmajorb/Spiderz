# Spiderz
A simple multiplayer web based game (pun intended)

Getting started:

Run the following commands in your root project directory after installing npm\
npm init\
npm install --save express socket.io

You may have to do some port forwarding if you want to show it on port 80. I used the following:\
sudo iptables -t nat -L\
sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-ports 5000

Use the following command to start the server\
node server.js
