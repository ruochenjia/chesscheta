import { game, evaluateBoard } from "./gamebase.js";
import { io } from "./lib/socket.io.esm.min.js";
import { clientConfig } from "./clientconfig.js";
import { UCIEngine } from "./uci.js";
import { storage } from "./storage.js";

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

if (typeof SharedArrayBuffer == "undefined" && typeof stockfish == "undefined") {
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

const engine = UCIEngine();
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
await engine.init("stockfish");
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
	let clientId = storage.clientId;
	if (clientId == null)
		clientId = storage.clientId = genCliId();

	socket.emit("client_id", clientId);

	// update online players every second
	setInterval(() => {
		if (socket.connected) {
			socket.emit("req_users");
		}
	}, 1000);
});
socket.on("invalid_id", () => {
	let clientId = genCliId();
	storage.clientId = clientId;
	socket.emit("client_id", clientId);
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
	$(`input[type=\"radio\"][name=\"color\"][value=\"${storage.getItem("color", "r")}\"]`).prop("checked", true);
	$("#search-time").val(storage.getItem("searchTime", "2"));
	$("#search-depth").val(storage.getItem("searchDepth", "0"));
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
	changeScreen("#online-option-screen");
	$("#nickname").val(storage.getItem("nickname", "Player"));
	$("#player-id").text(storage.clientId);
});
$("input[type=\"radio\"][name=\"color\"]").on("change", () => {
	storage.color = $("input[type=\"radio\"][name=\"color\"]:checked").val();
});
$("#search-time").on("change", () => {
	storage.searchTime = $("#search-time :selected").val();
});
$("#search-depth").on("change", () => {
	storage.searchDepth = $("#search-depth :selected").val();
});
$("#nickname").on("change", () => {
	storage.nickname = $("#nickname").val();
});
$("#play").on("click", async () => {
	let color = $("input[type=\"radio\"][name=\"color\"]:checked").val();
	if (color == "r")
		color = Math.random() > 0.5 ? "w" : "b";

	config.color = color;
	config.searchTime = $("#search-time :selected").val();
	config.searchDepth = $("#search-depth :selected").val();
	config.mode = "single";

	$("#local").css("display", "block");
	$("#sp").css("display", "block");
	$("#show-hint").prop("checked", storage.getItem("showHint", false));
	changeScreen("#game-screen");
	newGame();

	if (color == "w")
		board.orientation("white");
	else {
		board.orientation("black");
		await makeBestMove();
	}

	showHint();
});
$("#quick-match").on("click", () => {
	alert("", "Server Connection Failure");
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
$("#restart").on("click", async () => {
	newGame();
	if (config.mode == "single") {
		if (config.color != "w")
			await makeBestMove();
		showHint();
	}
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
		if (config.mode == "single") {
			if (config.color != game.turn())
				await makeBestMove();
			showHint();
		}
	} else alert("Invalid FEN string", "Error");
});
$("#show-hint").on("change", () => {
	storage.showHint = $("#show-hint").is(":checked");
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
	config.ponderMove = null;
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
		// undo twice in single player mode
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
		// redo twice in single player mode
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
	// recalculation is required after undo
	config.ponderMove = null;
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

function checkStatus(color) {
	let current, next, msg, gameOver = false;

	if (color == "w") {
		current = "White";
		next = "Black";
	} else {
		current = "Black";
		next = "White";
	}

	// avoid using game.game_over() for performance reasons
	if (game.in_checkmate()) {
		msg = `<b>Checkmate!</b> <b>${current}</b> won.`
		gameOver = true;
	} else if (game.insufficient_material()) {
		msg = `<b>Draw!</b> (Insufficient Material)`;
		gameOver = true;
	} else if (game.in_threefold_repetition()) {
		msg = `<b>Draw!</b> (Threefold Repetition)`;
		gameOver = true;
	} else if (game.in_stalemate()) {
		msg = `<b>Draw!</b> (Stalemate)`;
		gameOver = true;
	} else if (game.in_draw()) {
		msg = `<b>Draw!</b> (50-move Rule)`;
		gameOver = true;
	} else if (game.in_check())
		msg = `<b>${next}</b> to move, and is in <b>check!</b>`;
	else
		msg = `<b>${next}</b> to move.`;

	$("#status").html(msg);

	if (gameOver) {
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
	let output = (await engine.grep("bestmove")).split(" ");
	let move = output[1];
	let moveObj = {
		from: move[0] + move[1],
		to: move[2] + move[3],
	};

	if (output.length == 4) {
		let ponder = output[3];
		let ponderObj = {
			from: ponder[0] + ponder[1],
			to: ponder[2] + ponder[3]
		};
		moveObj.ponder = ponderObj;
	}

	return moveObj;
}

async function showHint() {
	$("#board .square-55d63").removeClass('highlight-hint');

	if ($("#show-hint").is(":checked") && !game.game_over()) {
		let move = config.ponderMove;
		if (move == null)
			move = await getBestMove();
		$("#board .square-" + move.from).addClass('highlight-hint');
		$("#board .square-" + move.to).addClass('highlight-hint');
	}
}

async function makeBestMove() {
	let move = await getBestMove();
	config.ponderMove = move.ponder;
	makeMove(move.from, move.to, "q");
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
