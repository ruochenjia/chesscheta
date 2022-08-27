
const engines = {
	stub: {
		init: async () => {
			return {
				message: () => null,
				postMessage: () => {}
			};
		}
	},

	stockfish: {
		init: async () => {
			// native module
			if (typeof window.stockfish != "undefined")
				return window.stockfish;
			
			// wasm module
			let script = document.createElement("script");
			script.src = "lib/stockfish.js";
			script.type = "text/javascript";
			script.async = true;
			document.getElementsByTagName("head")[0].appendChild(script);
			await new Promise(resolve => {
				script.onload = resolve;
			});

			let stockfish = await Stockfish();
			let messages = [];

			stockfish.addMessageListener(msg => {
				messages.push(msg);
			});

			return {
				message: () => {
					if (messages.length > 0)
						return messages.shift();
					return null;
				},
				postMessage: stockfish.postMessage
			};
		}
	}
};


function UCIEngine() {
	let base = null;

	/**
	 * @param {string} name 
	 */
	async function init(name) {
		base = await engines[name].init();
	}

	/**
	 * @returns {string | null}
	 */
	function read() {
		return base.message();
	}

	/**
	 * @param {string} text 
	 */
	function write(text) {
		base.postMessage(text);
	}

	/**
	 * @param {string} text 
	 * @returns {Promise<string>}
	 */
	function grep(text) {
		return new Promise((resolve) => {
			let timer = setInterval(() => {
				let msg = this.read();
				if (msg != null && msg.includes(text)) {
					clearInterval(timer);
					resolve(msg);
				}
			}, 50);
		});
	}

	return {
		init,
		read,
		write,
		grep
	};
}

export { UCIEngine };
