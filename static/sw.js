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
        headers
    });
}

self.addEventListener("fetch", (event) => {
	event.respondWith(fetchRe(event));
});
