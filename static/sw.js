import { headers } from "./headers.js";

const cacheName =  self.location.hostname + "-" + "chesscheata";

async function fetchRe({ request }) {
	let response = await caches.match(request);
	if (response == null) {
		response = await fetch(request);
		(await caches.open(cacheName)).put(request, response.clone());
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

self.addEventListener("fetch", (event) => {
	event.respondWith(fetchRe(event));
});
