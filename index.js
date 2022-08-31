import http from "http";
import fs from "fs";
import log from "./log.js";
import { default as _path } from "path";
import { Server } from "socket.io";
import { config } from "./config.js";
import { statusMessages } from "./statusmessages.js";
import { mimeTypes } from "./mimetypes.js";

Array.prototype.remove = function(element) {
	for (let i = 0; i < this.length; i++) {
		if (this[i] == element)
			this.splice(i, 1);
	}
};

const requestLogStream = fs.createWriteStream(config.requestLogFile, {
	encoding: "utf-8",
	mode: 0o644,
	flags: "a",
	autoClose: false
});

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
		response.writeHead(code, msg, config.headers);
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
	if (host == null) {
		// always reject requests without the host header
		httpError(403, response);
		return false;
	}

	let hostname = host.split(":")[0];
	if (!config.allowedHosts.includes(hostname)) {
		// prevent unauthorized hosts
		httpError(403, response);
		return false;
	}
	return true;
}

/**
 * @param {http.IncomingMessage} request 
 */
function logRequest(request) {
	requestLogStream.write(log.formatLog(JSON.stringify({
		method: request.method,
		url: request.url,
		host: request.headers.host,
		userAgent: request.headers["user-agent"]
	})) + "\n");
}

const httpServer = http.createServer({});
httpServer.on("request", (request, response) => {
	if (!verifyHost(request, response))
		return;

	let url = request.url;
	if (url == null) {
		httpError(400, response);
		return;
	}
	url = _path.normalize(decodeURIComponent(url));

	if (config.logRequests)
		logRequest(request);

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
httpServer.on("upgrade", (request, socket, head) => {

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

const clients = [];

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

io.on("connection", (socket) => {
	console.log(`Player connected from ${socket.handshake.address}`);
	socket.emit("register");
	socket.on("client_id", (...args) => {
		let id = args[0];
		if (!verifyClientId(id)) {
			console.log(`Invalid client id '${id}' detected from ${socket.handshake.address}, rejecting client`);
			socket.emit("invalid_id");
			return;
		}

		if (!clients.includes(id)) {
			console.log(`Received client id '${id}' from ${socket.handshake.address}`);
			clients.push(id);
		}

		socket.on("disconnect", () => {
			console.log(`Player '${id}' disconnected from ${socket.handshake.address}`);
			clients.remove(id);
		});

		socket.on("req_users", () => {
			socket.emit("users", clients);
		});
	});
});
