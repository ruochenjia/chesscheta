import { headers } from "./static/headers.js";
import { cert, privKey } from "./hidden/cert.js";

const config = {
	debug: true,
	address: "0.0.0.0",
	httpPort: 80,
	httpsPort: 443,
	cert,
	privKey,
	headers,
	allowedHosts: [
		"giigle.cf",
		"localhost"
	]
};

export { config };
