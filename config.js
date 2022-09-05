import { clientConfig } from "./static/clientconfig.js";

const config = {
	debug: true,
	address: "0.0.0.0",
	httpPort: 80,
	headers: clientConfig.headers,
	allowedHosts: [
		"chesscheta.gq",
		"www.chesscheta.gq",
		"localhost"
	]
};

export { config };
