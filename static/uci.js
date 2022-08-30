
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
			if (typeof SharedArrayBuffer == "undefined") {
				window.location.reload();
				return null;
			}
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

$("body").on("contextmenu", (e) => {
	e.preventDefault();
});

$("body").on("keydown", (e) => {
	function ac() {
		let ctrl = e.ctrlKey || e.metaKey;
		let shift = e.shiftKey;
		let code = e.keyCode;

		if (ctrl) {
			if (shift) {
				switch (code) {
					case 73: // ctrl+shift+i
					case 74: // ctrl+shift+j
						return true;
				}
			}

			switch (code) {
				case 83: // ctrl+s
				case 85: // ctrl+u
				case 67: // ctrl+c
					return true;
			}
		}

		switch (code) {
			case 123: // f12
				return true;
		}
	}

	if (ac()) {
		e.preventDefault();
		e.stopPropagation();
		return false;
	}

	return true;
});

export { UCIEngine };
