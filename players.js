import fs from "fs";

/**
 * @param {String} id 
 */
function Player(id, online = false) {
	this.id = id;
	this.info = {};
	this.online = online;
	this.matching = false;
}

/**
 * @param {String} file 
 */
export function Players(file) {
	/**
	 * @type { Player[] }
	 */
	let players = (() => {
		if (fs.existsSync(file)) {
			return JSON.parse(fs.readFileSync(file, { encoding: "utf-8" }));
		}

		return [];
	})();

	// fix dead lock
	for (let p of players) {
		p.online = false;
		p.matching = false;
	}

	/**
	 * @param {String} id
	 */
	let getItem = (id) => {
		for (let o of players) {
			if (o.id == id)
				return o;
		}
		return null;
	};

	/**
	 * @param {String} id 
	 */
	let removeItem = (id) => {
		for (let i in players) {
			if (players[i].id == id)
				players.splice(i, 1);
		}
	};

	this.getItem = getItem;
	this.removeItem = removeItem;

	/**
	 * @param {String} id
	 */
	this.add = (id) => {
		let it = getItem(id);
		if (it == null)
			players.push(new Player(id, true));
		else it.online = true;
	};

	/**
	 * @param {String} id
	 */
	this.remove = (id) => {
		let it = getItem(id);
		if (it != null) {
			it.online = false;
			it.matching = false;
		}
	};

	/**
	 * @param {String} id 
	 * @param {*} info 
	 */
	this.setInfo = (id, info) => {
		let it = getItem(id);
		if (it != null)
			it.info = info;
	};

	this.save = () => {
		fs.writeFileSync(file, JSON.stringify(players, null, "\t"), { encoding: "utf-8", mode: 0o644 });
	};

	// autosave
	setInterval(this.save, 10000);

	this.onlinePlayers = () => {
		let pl = [];
		for (let p of players) {
			if (p.online)
				pl.push(p.id);
		}
		return pl;
	};

	/**
	 * @param {String} id 
	 */
	this.startMatching = (id) => {
		let it = getItem(id);
		if (it != null)
			it.matching = true;
	};

	/**
	 * @param {String} id 
	 */
	this.stopMatching = (id) => {
		let it = getItem(id);
		if (it != null)
			it.matching = false;
	};

	/**
	 * @param {String} id 
	 * @param {(result) => void} callback 
	 */
	this.quickMatch = (id, socket, callback) => {
		let timeout = false;
		setTimeout(() => timeout = true, 120000);

		let player = getItem(id);
		player.__cb = callback;
		// store as function to prevent json stringing
		player.__socket = () => socket;

		let timer = setInterval(() => {
			if (timeout) {
				clearInterval(timer);
				callback({ errorMsg: "Timeout" });
				return;
			}

			if (!player.matching) {
				// cancelled
				clearInterval(timer);
				return;
			}
			
			for (let p of players) {
				if (p.matching && p.id != id) {
					p.matching = false;
					clearInterval(timer);

					callback({
						opponent: p,
						color: "w"
					});

					p.__cb({
						opponent: player,
						color: "b"
					});
				}
			}
		});
	};
}