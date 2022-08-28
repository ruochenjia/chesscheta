
function checkLocalStorage() {
	try {
		localStorage.setItem("test", "___test");
		if (localStorage.getItem("test") !== "___test")
			throw "Value mismatch";
		localStorage.removeItem("test");
		return true;
	} catch (err) {
		return false;
	}
}

let storage = (() => {
	let base;

	if (checkLocalStorage()) {
		let data = localStorage.getItem("data");
		if (data == null)
			data = "{}";

		base = JSON.parse(data);
		base.save = function () {
			localStorage.setItem("data", JSON.stringify(this));
		};
	} else {
		alert("Local storage is disabled by your browser, your game data will not be saved.", "Warning");
		base = {
			save: () => {
				// stub
			}
		};
	}

	base.getItem = function (key, def) {
		let item = this[key];
		if (item == null)
			return this[key] = def;
		return item;
	};

	setInterval(() => {
		// autosave
		base.save();
	}, 10000);

	return base;
})();

window.onbeforeunload = window.onunload = () => {
	storage.save();
};

export { storage };
