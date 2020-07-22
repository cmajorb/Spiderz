# Spiderz
A simple and fun multiplayer web based game (pun intended)\
The game is built on three main components: the server (NodeJs), the database (mySQL), and the client (JavaScript). All requests are handled with sockets using SocketIO. 

Getting started:

To get started right away, use Docker to run all required components.\
Once Docker is up and running use the following command:\
docker-compose up --build -d

Navigate to localhost:5000 to access the game.

For production, you may have to redirect the port if you want to show it on port 80. I used the following:\
sudo iptables -t nat -L\
sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-ports 5000

