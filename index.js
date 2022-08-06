import http from "http";
import fs from "fs";
import path from "path";
import { Server } from "socket.io";
import { config } from "./config.js";


// log mod
(() => {
	let log = console.log;

	console.log = (...args) => {
		log.apply(console, [new Date().toLocaleString()].concat(args));
	};
})();




// static headers
const headers = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET",
	"Access-Control-Allow-Credentials": "true",
	"Allow-Chrome": "false",
	"Cross-Origin-Embedder-Policy": "require-corp",
	"Cross-Origin-Opener-Policy": "same-origin",
	"Referrer-Policy": "no-referrer",
	"X-Content-Type-Options": "nosniff",
	"X-Frame-Options": "SAMEORIGIN"
};

/**
 * @param {String} rPath 
 * @returns 
 */
function getContentType(rPath) {
	switch (path.extname(rPath)) {
		case ".html":
		case ".htm":
		case ".xml":
		case ".xhtml":
		case ".xht":
			return "text/html";
		case ".js":
			return "text/javascript";
		case ".css":
			return "text/css";
		case ".txt":
			return "text/plain";
		case ".json":
			return "application/json";
		case ".png":
			return "image/png";
		case ".jpg":
		case ".jpeg":
			return "image/jpeg";
		case ".svg":
			return "image/svg";
		case ".ico":
			return "image/x-icon";
		case ".wasm":
			return "application/wasm";
		default:
			return "unknown/unknown";
	}
}

/**
 * @param {String} path 
 * @returns {String}
 */
function getIndexFile(path) {
	if (!path.endsWith("/"))
		path += "/";
	
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
		let p = path + f;
		if (fs.existsSync(p))
			return p;
	}
	return null;
}

/**
 * @param {http.ServerResponse} response 
 */
function notFound(response) {
	let doc = "./static/404.html";
	if (fs.existsSync(doc)) {
		let file = fs.readFileSync(doc, { encoding: "utf-8" });
		let head = { ...headers };
		head["Content-Type"] = "application/xhtml+xml"
		response.writeHead(404, "", head);
		response.end(file, "utf-8");
	} else {
		response.writeHead(404, "Not found", headers);
		response.write("Not found");
		response.end();
	}
}

const server = http.createServer((request, response) => {
	let path = "./static" + request.url;

	if (fs.existsSync(path)) {
		let stat = fs.lstatSync(path, {
			bigint: true,
			throwIfNoEntry: true
		});

		if (stat.isDirectory()) {
			path = getIndexFile(path);
			if (path == null) {
				notFound(response);
				return;
			}
		}

		let file = fs.readFileSync(path);
		let head = { ...headers };
		head["Content-Type"] = getContentType(path);

		response.writeHead(200, "", head);
		response.end(file, "utf-8");

	} else notFound(response);
});

const io = new Server(server, {
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
	console.log("Player connected");

	socket.emit("register");
	socket.on("client_id", (...args) => {
		let id = args[0];
		if (verifyClientId(id)) {
			if (!clients.includes(id)) {
				console.log("Received client id: ", id);
				clients.push(id);
				socket.on("disconnect", () => {
					console.log("Player " + id + " disconnected");
					clients.remove(id);
				});
			}
		} else {
			console.log(`Invalid client id '${id}' detected, rejecting client`);
			socket.emit("invalid_id");
		}
	});
	socket.on("req_users", () => {
		socket.emit("users", clients);
	});
});

server.listen(config.port, config.address, () => {
	console.log("HTTP server started");
});

