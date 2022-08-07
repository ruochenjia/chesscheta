import { headers } from "./static/headers.js";

const config = {
	debug: true,
	address: "0.0.0.0",
	httpPort: 80,
	headers,
	allowedHosts: [
		"chesscheata.gq",
		"www.chesscheata.gq"
	]
};

export { config };
