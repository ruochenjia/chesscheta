import { game, evaluateBoard } from "./gamebase.js";
import { io } from "./lib/socket.io.esm.min.js";
import { clientConfig } from "./clientconfig.js";

(async () => {
// default error handler
window.onerror = (msg, src, lineno, colno, e) => {
	alert(msg, "Error");
};

// register service worker if available
if ("serviceWorker" in window.navigator && window.location.hostname != "localhost") {
	window.navigator.serviceWorker.register("./sw.js", {
		scope: "/",
		type: "module",
		updateViaCache: "all"
	});
}

if (typeof SharedArrayBuffer == "undefined" && typeof stockfish == undefined) {
	window.location.reload();
	return;
}

Array.prototype.remove = function(element) {
	for (let i = 0; i < this.length; i++) {
		if (this[i] == element)
			this.splice(i, 1);
	}
};

Array.prototype.last = function() {
	let len = this.length;
	if (len < 1)
		return null;
	return this[len - 1];
};

const engine = await (async () => {
	let base;
	if (typeof stockfish == "undefined") {
		// load required scripts
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
			// log output messages for debugging
			if (clientConfig.debug)
				console.log(msg);

			messages.push(msg);
		});

		base = {
			message: () => {
				if (messages.length > 0) {
					let msg = messages[0];
					messages.splice(0, 1);
					return msg;
				}
				return null;
			},
			postMessage: stockfish.postMessage
		};
	} else base = stockfish;

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
	 * @param {String} text 
	 * @returns {Promise<String>}
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
		read,
		write,
		grep
	}
})();
const board = Chessboard("board", {
	draggable: true,
	position: "start",
	onDragStart,
	onDrop,
	onMouseoverSquare,
	onMouseoutSquare,
	onSnapEnd
});
const config = {};

// debug only
if (clientConfig.debug)
	window.game = game;

// engine init
engine.read();
engine.write("uci");
engine.write("setoption name Threads value 4");
engine.write("setoption name Hash value 128");
engine.write("setoption name UCI_Elo value 2500");
await engine.grep("uciok");
engine.write("isready");
engine.grep("readyok");

// server init
const socket = io(clientConfig.server);
socket.on("register", () => {
	let clientId = localStorage.getItem("client_id");
	if (clientId == null) {
		clientId = genCliId();
		localStorage.setItem("client_id", clientId);
	}
	socket.emit("client_id", clientId);

	// update online players every second
	setInterval(() => {
		if (socket.connected) {
			socket.emit("req_users");
		}
	}, 1000);
});
socket.on("invalid_id", () => {
	let id = genCliId();
	localStorage.setItem("client_id", id);
	socket.emit("client_id", id);
});
socket.on("users", (...args) => {
	$("#players").text(args[0].length);
});


// event listeners
$("#board").on("touchmove touchend touchstart", (e) => {
	// prevent scroll while dragging pieces
	if (e.cancelable)
		e.preventDefault();
});
$("#single-player").on("click", () => {
	changeScreen("#option-screen");
});
$("#local-multiplayer").on("click", () => {
	config.mode = "local";
	$("#local").css("display", "block");
	$("#sp").css("display", "none");
	changeScreen("#game-screen");
	newGame();
	board.orientation("white");
});
$("#online-multiplayer").on("click", () => {
	alert("Coming soon!");
});
$("#play").on("click", () => {
	let color = $("input[type=\"radio\"][name=\"color\"]:checked").val();
	if (color == "r")
		color = Math.random() > 0.5 ? "w" : "b";

	config.color = color;
	config.searchTime = $("#search-time :selected").val();
	config.searchDepth = $("#search-depth :selected").val();
	config.mode = "single";

	$("#local").css("display", "block");
	$("#sp").css("display", "block");
	changeScreen("#game-screen");
	newGame();

	if (color == "w")
		board.orientation("white");
	else {
		board.orientation("black");
		makeBestMove();
	}		
});
$("#undo").on("click", () => {
	if (undo()) {
		removeHighlights();
		updateAdvantage();
		showHint();
		$("#pgn").text(game.pgn());
	} else alert("Nothing to undo");
});
$("#redo").on("click", () => {
	if (redo()) {
		removeHighlights();
		updateAdvantage();
		showHint();
		$("#pgn").text(game.pgn());
	} else alert("Nothing to redo");
});
$("#restart").on("click", () => {
	newGame();
	if (config.mode == "single" && config.color != "w")
		makeBestMove();
});
$("#menu-btn").on("click", () => {
	changeScreen("#menu-screen");
});
$("#save").on("click", () => {
	alert(`Game FEN String: <br/><br /><b>${game.fen()}</b><br /><br/>Please copy and save the text above.`, "Save");
});
$("#load").on("click", async () => {
	let fen = await prompt("Please enter a valid FEN string.", "", "Load");
	if (fen == null)
		return;

	if (game.load(fen)) {
		resetBoard();
		if (config.mode == "single" && config.color != game.turn())
			makeBestMove();
	}
	else alert("Invalid FEN string", "Error");
});
$("#show-hint").on("change", () => {
	showHint();
});
// chessboard resize handler
$(window).on("resize", resizeBoard);

function changeScreen(id) {
	$(".screen").css("visibility", "hidden");
	$(id).css("visibility", "visible");
}

function resizeBoard() {
	let width = $("#board").width();
	let height = $("#board").height();

	if (width != height)
		$("#board").height(width);

	board.resize();
}

resizeBoard();

function removeHighlights() {
	$("#board .square-55d63").removeClass("highlight-white");
	$("#board .square-55d63").removeClass("highlight-black");
	$("#board .square-55d63").removeClass("highlight-hint");
}

function newGame() {
	game.reset();
	resetBoard();
}

function resetBoard() {
	engine.write("ucinewgame");
	config.prevSum = 0;
	config.globalSum = 0;
	config.moves = [];
	config.undoStack = [];
	board.position(game.fen(), false);
	removeHighlights();
	updateAdvantage();
	$("#status").html(`<b>${game.turn() == "w" ? "White": "Black"}</b> to move.`);
	$("#pgn").html("");
}

function undo() {
	let length = config.moves.length;
	if (config.mode != "single" && length >= 1) {
		_undo();
		return true;
	}

	if (length >= 2) {
		_undo();
		_undo();
		return true;
	}

	return false;
}

function redo() {
	let length = config.undoStack.length;
	if (config.mode != "single" && length >= 1) {
		_redo();
		return true;
	}

	if (length >= 2) {
		_redo();
		_redo();
		return true;
	}

	return false;
}

function _undo() {
	game.undo();
	let move = config.moves.pop();
	let last = config.moves.last();
	config.globalSum = last == null ? 0 : last.sum;
	config.undoStack.push(move);
	board.position(game.fen());
}

function _redo() {
	let move = config.undoStack.pop();
	game.move(move);
	config.moves.push(move);
	config.globalSum = move.sum;
	board.position(game.fen());
}

function updateAdvantage() {
	let sum = config.globalSum;
	if (sum > 0) {
		$("#advantageColor").text("Black");
		$("#advantageNumber").text(sum);
	} else if (sum < 0) {
		$("#advantageColor").text("White");
		$("#advantageNumber").text(-sum);
	} else {
		$("#advantageColor").text("Neither side");
		$("#advantageNumber").text(sum);
	}
	$("#advantageBar").attr({
		"aria-valuenow": `${-sum}`,
		style: `width: ${(() => {
			let v = (-sum + 2000) / 40;
			if (v > 100)
				v = 100;
			if (v < 0)
				v = 0;
			return Math.round(v);
		})()}%`
	});
}

function getStatusMessage(current, next) {
	if (game.in_checkmate())
		return `<b>Checkmate!</b> <b>${current}</b> won.`
	else if (game.insufficient_material())
		return `<b>Draw!</b> (Insufficient Material)`;
	else if (game.in_threefold_repetition())
		return `<b>Draw!</b> (Threefold Repetition)`;
	else if (game.in_stalemate())
		return `<b>Draw!</b> (Stalemate)`;
	else if (game.in_draw())
		return `<b>Draw!</b> (50-move Rule)`;
	else if (game.in_check())
		return `<b>${next}</b> to move, and is in <b>check!</b>`;
	else
		return `<b>${next}</b> to move.`;
}

function checkStatus(color) {
	let current = color == "w" ? "White" : "Black";
	let next = color == "w" ? "Black" : "White";
	let msg = getStatusMessage(current, next);

	$("#status").html(msg);

	if (game.game_over()) {
		alert(msg, "Game Over");
		return true;
	} else return false;
}

async function getBestMove() {
	engine.write(`position fen ${game.fen()}`);

	let cmd = `go movetime ${config.searchTime}000`;
	let depth = config.searchDepth;
	if (depth != "0")
		cmd += " depth " + depth;

	engine.write(cmd);
	let output = await engine.grep("bestmove");
	let move = output.split(" ")[1];

	return {
		from: move[0] + move[1],
		to: move[2] + move[3]
	};
}

async function showHint() {
	$("#board .square-55d63").removeClass('highlight-hint');

	if ($("#show-hint").is(":checked")) {
		let move = await getBestMove();
		$("#board .square-" + move.from).addClass('highlight-hint');
		$("#board .square-" + move.to).addClass('highlight-hint');
	}
}

async function makeBestMove() {
	let bestMove = await getBestMove();
	let move = makeMove(bestMove.from, bestMove.to, "q");
	if (move == null) {
		alert("An unexpected error occurred while moving for " + game.turn(), "Internel Error");
		return;
	}

	board.position(game.fen());
}

function highlightMove(move) {
	if (move.color == "b") {
		$("#board .square-55d63").removeClass("highlight-black");
	  	$("#board .square-" + move.from).addClass("highlight-black");
		$("#board .square-" + move.to).addClass("highlight-black");
	} else {
		$("#board .square-55d63").removeClass("highlight-white");
	  	$("#board .square-" + move.from).addClass("highlight-white");
		$("#board .square-" + move.to).addClass("highlight-white");
	}
}

function makeMove(from, to, promotion) {
	let move = game.move({ from, to, promotion });
	if (move == null)
		return null;

	let sum = evaluateBoard(move, config.globalSum, "b");
	move.sum = sum;
	move.status = checkStatus(move.color);
	config.moves.push(move);
	config.globalSum = sum;
	updateAdvantage();
	highlightMove(move);
	$("#pgn").text(game.pgn());
	return move;
}

function onDrop(source, target) {
	config.undoStack = [];
	removeGreySquares();

	let move = makeMove(source, target, "q");
	if (move == null)
		return "snapback";

	if (!move.status && config.mode == "single") {
		makeBestMove().then(() => {
			showHint();
		});
	}
}

function shouldMove(piece) {
	if (game.game_over())
		return false;
	
	if (config.mode == "single")
		return piece[0] == config.color;
	else return game.turn() == piece[0];
}

function onDragStart(source, piece, position, orientation) {
	return shouldMove(piece);
}

function removeGreySquares() {
	$("#board .square-55d63").removeClass("highlight-moveable")
}
  
function greySquare(square) {
	$("#board .square-" + square).addClass("highlight-moveable");
}

function onMouseoverSquare(square, piece) {
	if (!shouldMove(piece))
		return;

	let moves = game.moves({
		square,
		verbose: true
	});

	for (let i = 0; i < moves.length; i++)
		greySquare(moves[i].to);
}
  
function onMouseoutSquare(square, piece) {
	removeGreySquares();
}

function onSnapEnd() {
	board.position(game.fen());
}

function genCliId() {
	let str = "";
	for (let i = 0; i < 20; i++)
		str += Math.floor(Math.random() * 9);
	return str;
}

$("#loading-screen").remove();

})();
