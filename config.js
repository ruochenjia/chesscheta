import { headers } from "./static/headers.js";

const config = {
	debug: true,
	address: "127.0.0.1",
	httpPort: 80,
	headers,
	allowedHosts: [
		"chesscheata.gq",
		"www.chesscheata.gq",
		"localhost"
	]
};

export { config };
