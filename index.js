import http from "http";
import fs from "fs";
import log from "./log.js";
import { default as _path } from "path";
import { Server } from "socket.io";
import { config } from "./config.js";
import { statusMessages } from "./statusmessages.js";
import { mimeTypes } from "./mimetypes.js";
import { Players } from "./players.js";
import { Game, Games } from "./games.js";

Array.prototype.remove = function(element) {
	for (let i = 0; i < this.length; i++) {
		if (this[i] == element)
			this.splice(i, 1);
	}
};

/**
 * @param {number} code
 * @param {http.ServerResponse} response 
 */
function httpError(code, response) {
	let errorDoc = `./static/${code}.html`;
	let msg = statusMessages[code.toString()];
	let head = { ...config.headers };

	if (fs.existsSync(errorDoc)) {
		let file = fs.readFileSync(errorDoc, { encoding: "utf-8" });
		head["Content-Type"] = "text/html";
		response.writeHead(code, msg, head);
		response.end(file, "utf-8");
	} else {
		head["Content-Type"] = "text/plain";
		response.writeHead(code, msg, head);
		response.write(msg, "utf-8");
		response.end();
	}
}

/**
 * @param {String | undefined} host 
 */
function verifyHost(host) {
	if (host == null) {
		// always reject requests without the host header
		return false;
	}

	let hostname = host.split(":")[0];
	if (!config.allowedHosts.includes(hostname)) {
		// prevent unauthorized hosts
		return false;
	}

	return true;
}

/**
 * @param {String | undefined} url 
 */
function getRequestUrl(url) {
	if (url == null)
		return null;

	return _path.normalize(decodeURIComponent(url));
}

/**
 * @param {String} url 
 */
function getRequestPath(url) {
	let path = _path.join("./static", url);
	if (!fs.existsSync(path))
		return null;

	if (fs.lstatSync(path, { bigint: true, throwIfNoEntry: true }).isDirectory()) {
		for (let f of [
			"index.html",
			"index.htm",
			"index.xml",
			"index.xhtml",
			"index.xht",
			"index.txt",
			"index.png",
			"index.svg"
		]) {
			let p = _path.join(path, f);
			if (fs.existsSync(p))
				return p;
		}

		return null;
	}

	return path;
}

const httpServer = http.createServer({});
httpServer.on("request", (request, response) => {
	if (!verifyHost(request.headers.host)) {
		httpError(403, response);
		return;
	}

	let url = getRequestUrl(request.url);
	if (url == null) {
		httpError(400, response);
		return;
	}

	let path = getRequestPath(url);
	if (path == null) {
		httpError(404, response);
		return;
	}

	let file = fs.readFileSync(path);
	let head = { ...config.headers };
	let extName = _path.extname(path);
	if (extName in mimeTypes)
		head["Content-Type"] = mimeTypes[extName];

	response.writeHead(200, "", head);
	response.end(file, "utf-8");
});

httpServer.on("upgrade", (request, socket, head) => {
	// function not supported
	socket.end();
});

httpServer.listen(config.httpPort, config.address, () => {
	let addr = httpServer.address();
	console.log(`HTTP server started on ${addr.address}:${addr.port}`);
});



// socket.io server

const io = new Server(httpServer, {
	cors: {
		origin: "*",
		credentials: true
	},
	connectTimeout: 30000,
	pingTimeout: 10000,
	pingInterval: 20000,
	perMessageDeflate: true,
	httpCompression: true
});

const players = new Players();
const games = new Games();

/**
 * @param {String} id 
 */
function verifyClientId(id) {
	if (id.length != 20)
		return false;

	for (let i = 0; i < 20; i++) {
		let code = id.charCodeAt(i);
		if (code > 0x39 || code < 0x30)
			return false;
	}
	return true;
}

/**
 * @param {String} id 
 */
function disconnectPlayer(id) {
	let game = games.disconnect(id);
	if (game != null) {
		let op = id == game.playerW ? game.playerB: game.playerW;
		let p = players.getItem(op);
		if (p != null && p.__socket != null) {
			p.__socket().emit("game_abort");
		}
	}
}

io.on("connection", (socket) => {
	socket.emit("register");
	socket.on("client_id", (...args) => {
		let id = args[0];
		if (!verifyClientId(id)) {
			socket.emit("invalid_id");
			return;
		}

		players.add(id);

		socket.on("disconnect", () => {
			players.remove(id);
			disconnectPlayer(id);
		});

		socket.on("req_disconnect", () => {
			disconnectPlayer(id);
		});

		socket.on("req_quick_match", (...args) => {
			players.setInfo(id, args[0]);
			players.startMatching(id);

			socket.on("cancel_quick_match", () => {
				players.stopMatching(id);
			});

			players.quickMatch(id, socket, (result) => {
				if (result.errorMsg != null) {
					socket.emit("error_quick_match", result.errorMsg);
					return;
				}

				socket.emit("match", result);

				let game = games.getGame(id, result.opponent.id, result.color);
				let opSocket = result.opponent.__socket();

				socket.on("make_move", (...args) => {
					let move = args[0];
					let result = game.makeMove(move);
					if (result == Game.MOVE_ILLEGAL) {
						socket.emit("sync_move", {
							fen: game.fen,
							pgn: game.pgn
						});
					} else {
						opSocket.emit("move", move);
					}
				});
			});
		});
	});
});
