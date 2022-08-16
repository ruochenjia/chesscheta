import http from "http";
import fs from "fs";
import { default as _path } from "path";
import { Server } from "socket.io";
import { config } from "./config.js";
import { statusMessages } from "./statusmessages.js";
import { mimeTypes } from "./mimetypes.js";

// log mod
(() => {
	let log = console.log;

	console.log = (...args) => {
		log.apply(console, [new Date().toLocaleString()].concat(args));
	};
})();

/**
 * @param {String} path 
 * @returns {String}
 */
function getIndexFile(path) {
	const files = [
		"index.html",
		"index.htm",
		"index.xml",
		"index.xhtml",
		"index.xht",
		"index.txt",
		"index.png",
		"index.svg"
	];

	for (let f of files) {
		let p = _path.join(path, f);
		if (fs.existsSync(p))
			return p;
	}
	return null;
}

/**
 * @param {number} code
 * @param {http.ServerResponse} response 
 */
function httpError(code, response) {
	let errorDoc = `./static/${code}.html`;
	let msg = statusMessages[code.toString()];
	if (fs.existsSync(errorDoc)) {
		let file = fs.readFileSync(errorDoc, { encoding: "utf-8" });
		let head = { ...config.headers };
		head["Content-Type"] = "text/html";
		response.writeHead(code, msg, head);
		response.end(file, "utf-8");
	} else {
		response.writeHead(code, "", config.headers);
		response.write(msg, "utf-8");
		response.end();
	}
}

/**
 * @param {http.IncomingMessage} request 
 * @param {http.ServerResponse} response
 */
function verifyHost(request, response) {
	let host = request.headers.host;
	if (!config.allowedHosts.includes(host)) {
		// prevent unauthorized hosts
		response.writeHead(301, "Moved Permanently", { Location: `http://${config.allowedHosts[0]}${request.url}` });
		response.write("Moved Permanently");
		response.end();
		return false;
	}

	return true;
}

const httpServer = http.createServer({}, (request, response) => {
	if (!verifyHost(request, response))
		return;

	let url = decodeURIComponent(request.url);

	// reserved urls
	if (url.startsWith("/serveronline")) {
		response.writeHead(200, "", {
			Online: "1",
			Signature: ""			
		});
	}

	let path = _path.join("./static", url);
	if (!fs.existsSync(path)) {
		httpError(404, response);
		return;
	}

	if (fs.lstatSync(path, { bigint: true, throwIfNoEntry: true }).isDirectory()) {
		path = getIndexFile(path);
		if (path == null) {
			httpError(404, response);
			return;
		}
	}

	let file = fs.readFileSync(path);
	let head = { ...config.headers };
	let extName = _path.extname(path);
	if (extName in mimeTypes)
		head["Content-Type"] = mimeTypes[extName];

	response.writeHead(200, "", head);
	response.end(file, "utf-8");
});

httpServer.listen(config.httpPort, config.address, () => {
	console.log("HTTP server started");
});



// socket.io server

const io = new Server(httpServer, {
	cors: {
		origin: [],
		credentials: true
	}
});
const clients = [];

Array.prototype.remove = function(element) {
	for (let i = 0; i < this.length; i++) {
		if (this[i] == element)
			this.splice(i, 1);
	}
};

/**
 * @param {String} id 
 */
function verifyClientId(id) {
	if (id.length != 20)
		return false;

	for (let i = 0; i < id.length; i++) {
		let code = id.charCodeAt(i);
		if (code > 0x39 || code < 0x30)
			return false;
	}
	return true;
}

io.on("connection", (socket) => {
	console.log(`Player connected from ${socket.handshake.address}`);

	socket.emit("register");
	socket.on("client_id", (...args) => {
		let id = args[0];
		if (verifyClientId(id)) {
			if (!clients.includes(id)) {
				console.log(`Received client id '${id}' from ${socket.handshake.address}`);
				clients.push(id);
				socket.on("disconnect", () => {
					console.log(`Player '${id}' disconnected from ${socket.handshake.address}`);
					clients.remove(id);
				});
			}
		} else {
			console.log(`Invalid client id '${id}' detected from ${socket.handshake.address}, rejecting client`);
			socket.emit("invalid_id");
		}
	});
	socket.on("req_users", () => {
		socket.emit("users", clients);
	});
});
