import { headers } from "./headers.js";

const cacheName =  self.location.hostname + "-" + "chesscheata";
const fileList = [
	"/favicon.ico",
	"/gamebase.js",
	"/headers.js",
	"/index.html",
	"/main.js",
	"/manifest.json",
	"/robots.txt",
	"/sw.js",
	"/uciengine.js",
	"/img/chesspieces/wikipedia/bB.png",
	"/img/chesspieces/wikipedia/bK.png",
	"/img/chesspieces/wikipedia/bN.png",
	"/img/chesspieces/wikipedia/bP.png",
	"/img/chesspieces/wikipedia/bQ.png",
	"/img/chesspieces/wikipedia/bR.png",
	"/img/chesspieces/wikipedia/wB.png",
	"/img/chesspieces/wikipedia/wK.png",
	"/img/chesspieces/wikipedia/wN.png",
	"/img/chesspieces/wikipedia/wP.png",
	"/img/chesspieces/wikipedia/wQ.png",
	"/img/chesspieces/wikipedia/wR.png",
	"/lib/chess.js",
	"/lib/chessboard-1.0.0.min.js",
	"/lib/jquery-3.6.0.min.js",
	"/lib/socket.io.esm.min.js",
	"/lib/stockfish.js",
	"/lib/stockfish.wasm",
	"/lib/stockfish.worker.js",
	"/res/logo.svg",
	"/res/logo64.png",
	"/res/logo128.png",
	"/res/logo256.png",
	"/res/logo512.png",
	"/res/ubuntu-mono.ttf",
	"/res/ubuntu.ttf"
];

async function install() {
	let cache = await caches.open(cacheName);
	await cache.addAll(fileList);
}

async function fetchRe({ request }) {
	let response = await caches.match(request);
	if (response == null) {
		response = await fetch(request);
		try {
			let cache = await caches.open(cacheName);
			await cache.put(request, response.clone());
		} catch(err) {
			// ignore - this is usually caused by an unsupported request method
		}
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: (() => {
			let head = new Headers(response.headers);
			for (let e of Object.entries(headers))
				head.set(e[0], e[1]);
			return head;
		})()
	});
}

self.addEventListener("install", (event) => {
	event.waitUntil(install());
})

self.addEventListener("fetch", (event) => {
	event.respondWith(fetchRe(event));
});
