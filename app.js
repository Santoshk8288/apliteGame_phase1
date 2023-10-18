var express   	= require('express');
var http 		  	= require('http');
var app       	= express();
var server 			= http.createServer(app);
var io        	= require('socket.io').listen(server);
var timeToPlay 	= 60*1;
var time;

app.use(express.static(__dirname+'/client'));

app.get('/', function(req, res){
	res.sendFile(__dirname+'/client/index.html')
})

var playingUsers = []
// Socket.io Communication
var SOCKET_LIST = {}

var Entity = function(){
	var self = {
		x 		: 250,
		y 		: 250,
		spdX	: 0,
		spdY	: 0,
		id 		: ""
	}
	self.update = function(){
		self.updatePosition()
	}
	self.updatePosition = function(){
		self.x += self.spdX
		self.y += self.spdY
	}
	self.getDistance = function(pt){
		return Math.sqrt(Math.pow(self.x - pt.x, 2) + Math.pow(self.y - pt.y, 2))
	}
	self.getRemainingBullets = function(gun){
		var bulletLeft
		if(gun == 'double_gun.png'){
			bulletLeft =	12			
		}
		else if(gun == 'machine_gun.png'){
			bulletLeft = 50
		}
		else if(gun == 'shot_gun.png'){
			bulletLeft = 5
		}
		else{
			bulletLeft = 6			
		}
		return bulletLeft
	}
	self.super_sootbullet = function(angle, id, bulletLeft, power, x, y){
		if(bulletLeft >0){
			if(power == 'double_gun.png'){
				var b1 = Bullet(id, 0)
				var b2 = Bullet(id, -180)
				b1.x = x;
				b1.y = y;	
				b2.x = x;
				b2.y = y;
				bulletLeft -=2			
			}
			else if(power == 'machine_gun.png'){
				var b = Bullet(id, angle)
				b.x = x;
				b.y = y;
				b.spdX = Math.cos(angle/180*Math.PI)*20;
				b.spdY = Math.sin(angle/180*Math.PI)*20;
				bulletLeft--
			}
			else if(power == 'shot_gun.png'){
				var b1 = Bullet(id, angle)
				var b2 = Bullet(id, angle)
				var b3 = Bullet(id, angle)
				b1.x = x;
				b1.y = y+2;
				b2.x = x;
				b2.y = y+2;
				b3.x = x;
				b3.y = y+2;
				if(angle == 0) angle =360
				b1.spdX = Math.cos(angle/150*Math.PI)*10;
				b1.spdY = Math.sin(angle/150*Math.PI)*10;
				b2.spdX = Math.cos(angle/180*Math.PI)*10;
				b2.spdY = Math.sin(angle/180*Math.PI)*10;
				b3.spdX = Math.cos(angle/210*Math.PI)*10;
				b3.spdY = Math.sin(angle/210*Math.PI)*10;
				bulletLeft--
			}
			else{
				var b = Bullet(id, angle)
				b.x = x;
				b.y = y;
				bulletLeft--
			}
		}
		else{
			SOCKET_LIST[self.id].emit('showBulletOverMsg')
		}
		return bulletLeft
	}
	return self
}

var Player = function(id){
	var self= Entity() 
	self.id							= id,
	self.number					= "" + Math.floor(10*Math.random()),
	self.pressingRight	= false,
	self.pressingLeft		= false,
	self.pressingUp			= false,
	self.pressingDown		= false,
	self.pressingAttack	= false,
	self.mouseAngle 		= 0,
	self.maxSpd					= 10,
	self.faced       		= 'right',
	self.die 						= false,
	self.playerimage    = '',
	self.bulletLeft			= 6,
	self.reloadMsg 			= false,
	self.name           = '',
	self.power   				= 'gun',
	self.heart  				= 3,
	self.check  				= true,
	self.score          = 0
	var super_update = self.update;
	self.update = function(){
		self.updateSpd();
		super_update();
		
		if(self.pressingAttack){
			self.shootbullet(self.mouseAngle)
		}
	}

	self.shootbullet = function(angle){
		self.bulletLeft = self.super_sootbullet(angle, self.id, self.bulletLeft, self.power, self.x, self.y)
	}
	
	self.updateSpd = function(){
		if(self.pressingRight && self.x<980){
			self.faced = 'right'
			self.spdX = self.maxSpd
		}
		else if(self.pressingLeft && self.x>5){
			self.faced = 'left'
			self.spdX = -self.maxSpd
		}
		else
			self.spdX = 0

		if(self.pressingUp && self.y>5){
			self.spdY = -self.maxSpd
		}
		else if(self.pressingDown && self.y<665){
			self.spdY = self.maxSpd
		}
		else
			self.spdY = 0
	}
	Player.list[id] = self
	return self
}

Player.list = {}

Player.onConnect = function(socket){
	var player = Player(socket.id);
	socket.on('keyPress', function(data){
		if(data.inputId === 'left')
			player.pressingLeft = data.status
		else if(data.inputId === 'right')
			player.pressingRight = data.status
		else if(data.inputId === 'up')
			player.pressingUp = data.status
		else if(data.inputId === 'down')
			player.pressingDown = data.status
		else if(data.inputId === 'attack')
			player.pressingAttack = data.status
		else if(data.inputId === 'mouseAngle')
			player.mouseAngle = data.status
	});
}

Player.onDisconnect = function(socket){
	delete Player.list[socket.id];
}

Player.update = function(){
	var pack = []
	var score = []
	for(var i in Player.list){
		var player = Player.list[i]
		if(!player.die)
			player.update()
		pack.push({
			x 					:player.x,
			y 					:player.y,
			number 			:player.number,
			faced 			:player.faced,
			die 				:player.die,
			playerImage :player.playerimage,
			reloadMsg   :player.reloadMsg,
			playerName  :player.name,
			hit 				:player.hit,
			hitX 				:player.hitX,
			hitY 				:player.hitY
		})
		score.push({
			player  		:player.name,
			score 			:player.score 
		})
	}
	return {pack:pack,score:score}
}

var Bullet = function(parent, angle){
	var self = Entity();
	self.id = Math.random();
	self.spdX = Math.cos(angle/180*Math.PI)*10;
	self.spdY = Math.sin(angle/180*Math.PI)*10;
	self.parent = parent;
	self.timer = 0;
	self.toRemove = false;
	var super_update = self.update;
	self.update = function(){
		if(self.timer++ > 50)
			self.toRemove = true
		super_update()

		for(var i in Player.list){
			var p = Player.list[i]
			if(self.getDistance(p) < 20 && self.parent != p.id){
				Player.list[self.parent].score += 2
				self.toRemove = true
				if(!self.check){
					self.check = !self.check
					p.heart--	
				}
			}
			
			if(p.heart == 0){
				p.die = true
				p.faced = 'die'
				self.toRemove = true
				SOCKET_LIST[p.id].emit('want to restart')
			}
		}
	}
	Bullet.list[self.id] = self
	return self
}

Bullet.list = {}

Bullet.update = function(){
	var pack = []
	for(var i in Bullet.list){
		var bullet = Bullet.list[i]
		bullet.update()
		if(bullet.toRemove)
			delete Bullet.list[i]
		else{
			pack.push({
				x:bullet.x,
				y:bullet.y
			})	
		}
	}
	return pack
}

var Power = function(){
	var self = Entity();
	self.id = Math.random();
	self.x = Math.floor(Math.random() * (980 - 5 + 1)) + 5;
	self.y = Math.floor(Math.random() * (655 - 5 + 1)) + 5;
	self.toAdd = true;
	var myArray = ['double_gun.png', 'machine_gun.png', 'shot_gun.png'];
	self.gun = myArray[Math.floor(Math.random() * myArray.length)];
	var super_update = self.update;
	self.update = function(){
		setTimeout(function(){
			self.toAdd = false
		},3000)
		for(var i in Player.list){
			var p = Player.list[i]
			if(self.getDistance(p) < 20){
				p.power = self.gun
				p.bulletLeft = self.getRemainingBullets(self.gun)
				self.toAdd = false
			}
		}
	}
	Power.list[self.id] = self
	return self
}

Power.list = {}

Power.update = function(){
	var pack = []
	for(var i in Power.list){
		var power = Power.list[i]
		power.update()
		if(power.toAdd){
			pack.push({
				x:power.x,
				y:power.y,
				gun:power.gun
			})
		}
		else{
			delete Power.list[i]
		}
	}
	return pack
}


io.sockets.on('connection', function(socket){
	socket.on('adduser', function(data){
		socket.id = Math.random();
		SOCKET_LIST[socket.id] = socket;
		Player.onConnect(socket)
		
		Player.list[socket.id].playerimage = data.playerImage
		Player.list[socket.id].name = data.playerName
		for(var i in Player.list){
			console.log(Player.list[i])
		}
		if(Object.keys(SOCKET_LIST).length == 1){
			startTimer()
		}
	})
	
	socket.on('bulletOver',function(){
		SOCKET_LIST[socket.id].emit('showBulletOverMsg')
	})
	
	socket.on('reloadGun', function(){
		Player.list[socket.id].power = 'gun'
		Player.list[socket.id].bulletLeft = 6
		Player.list[socket.id].reloadMsg = true
	})
	
	socket.on('re-play', function(){
		Player.list[socket.id].die = false
		Player.list[socket.id].heart = 3
		Player.list[socket.id].faced = 'right'
	})
	
	socket.on('disconnect', function(){
		delete SOCKET_LIST[socket.id];
		Player.onDisconnect(socket)
	});
});

setInterval(function(){
	var power = Power()
},1000*10)

var scores = []

setInterval(function(){
	var pack = {
		player: Player.update(),
		bullet: Bullet.update(),
		power : Power.update()
	}

	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i]
		socket.emit('newPositions',pack)
	}
	for(var i in Player.list){
		var p = Player.list[i]
		SOCKET_LIST[p.id].emit('gameStats', {bullets:p.bulletLeft, heart:p.heart, score:p.score})
	}
},1000/25)


function startTimer() {
	setTimeout(function(){
		Object.keys(SOCKET_LIST).forEach(function(socket){
			scores.push({
				player:Player.list[socket].name,
				score:Player.list[socket].score
			})
			Player.list[socket].die = true
			scores.sort(function(a, b){return a.score-b.score})
			console.log(scores)
			io.sockets.emit('gameover',scores[scores.length-1])
		})
	},1000*timeToPlay);
	(function updateTime(time){
		setTimeout(function(){
      if(time-=1){
        io.sockets.emit('timer', time)
        updateTime(time)
      }
      else{
      	time=0
      	io.sockets.emit('timer', time)
      	Object.keys(SOCKET_LIST).forEach(function(socket){
      		delete SOCKET_LIST[socket];
      		delete Player.list[socket];
      	})
      }
    },1000)
	})(timeToPlay)	
} 


server.listen(process.env.PORT || 8080);
console.log('Running on port %d...',process.env.PORT || 8080);
