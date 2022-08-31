const clientConfig = {
	headers: {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "GET",
		"Access-Control-Allow-Credentials": "true",
		"Cross-Origin-Embedder-Policy": "require-corp",
		"Cross-Origin-Opener-Policy": "same-origin",
		"Referrer-Policy": "no-referrer",
		"X-Content-Type-Options": "nosniff",
		"X-Frame-Options": "SAMEORIGIN"
	},
	server: "https://chesscheata.gq/",
	debug: true,
	cacheName: "chesscheata",
	cacheList: []
};

export { clientConfig };
