"use strict";

export class UCIEngine {
	___stub = {
		addMessageListener: () => {},
		postMessage: () => {}
	};

	constructor() {
		this.setNative(this.___stub);
	}

	setNative(native) {
		this._native = native;
		this.messages = [];

		native.addMessageListener((msg) => {
			// always log output messages for debugging
			console.log(msg);
			this.messages.push(msg);
		});
	}

	/**
	 * @returns {String | null}
	 */
	read() {
		let messages = this.messages;
		if (messages.length > 0) {
			let msg = messages[0];
			messages.splice(0, 1);
			return msg;
		}
		return null;
	}

	/**
	 * @param {String} text 
	 * @returns {Promise<String>}
	 */
	grep(text) {
		return new Promise((resolve) => {
			let timer = setInterval(() => {
				let msg = this.read();
				if (msg != null && msg.includes(text)) {
					clearInterval(timer);
					resolve(msg);
				}
			}, 50);
		});
	};

	/**
	 * @param {String} msg 
	 */
	write(msg) {
		this._native.postMessage(msg);
	};

	/**
	 * @param {String} name 
	 */
	async init(name) {
		let loadScript = (url) => {
			let script = document.createElement("script");
			script.src = url;
			script.type = "text/javascript";
			script.async = true;
			document.getElementsByTagName("head")[0].appendChild(script);
			return new Promise(resolve => {
				script.onload = resolve;
			});
		}

		switch(name) {
			case "stockfish":
				await loadScript("lib/stockfish.js");
				this.setNative(await Stockfish());
				break;
			case "stub":
				this.setNative(this.___stub);
			default:
				throw "Invalid engine name";
		}
	}
}
