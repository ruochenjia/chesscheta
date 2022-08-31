import { clientConfig } from "./static/clientconfig.js";

const config = {
	debug: true,
	address: "0.0.0.0",
	httpPort: 80,
	headers: clientConfig.headers,
	allowedHosts: [
		"chesscheata.gq",
		"www.chesscheata.gq",
		"localhost"
	],
	requestLogFile: "./request.log",
	logRequests: true
};

export { config };
