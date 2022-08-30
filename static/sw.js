import { clientConfig } from "./clientconfig.js";

const cacheName =  `${self.location.hostname}-${clientConfig.cacheName}`;

async function install() {
	let cache = await caches.open(cacheName);
	await cache.addAll(clientConfig.cacheList);
}

async function fetchRe({ request }) {
	let response = await caches.match(request);
	if (response == null) {
		response = await fetch(request);

		// cross origin responses
		if (response.status == 0)
			return response;

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
			for (let e of Object.entries(clientConfig.headers))
				head.set(e[0], e[1]);
			return head;
		})()
	});
}

self.addEventListener("install", (event) => {
	event.waitUntil(install());
});

self.addEventListener("fetch", (event) => {
	event.respondWith(fetchRe(event));
});
