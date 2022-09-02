import { clientConfig } from "./static/clientconfig.js";

const config = {
	debug: true,
	address: "0.0.0.0",
	httpPort: 80,
	headers: clientConfig.headers,
	allowedHosts: [
		"chesscheata.gq",
		"www.chesscheata.gq",
		"a54.chesscheata.gq",
		"localhost"
	],
	requestLogFile: "./request.log",
	playerInfoFile: "./players.json",
	gameInfoFile: "./games.json",
	logRequests: true
};

export { config };
