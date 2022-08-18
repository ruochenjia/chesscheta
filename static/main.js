import { game, evaluateBoard } from "./gamebase.js";
import { UCIEngine } from "./uciengine.js";
import { io } from "./lib/socket.io.esm.min.js";

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

if (typeof SharedArrayBuffer == "undefined") {
	window.location.reload();
	return;
}

const engine = new UCIEngine();
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
const socket = io();
socket.on("register", () => {
	let clientId = localStorage.getItem("client_id");
	if (clientId == null) {
		clientId = genCliId();
		localStorage.setItem("client_id", clientId);
	}
	socket.emit("client_id", clientId);
});
socket.on("invalid_id", () => {
	let id = genCliId();
	localStorage.setItem("client_id", id);
	socket.emit("client_id", id);
});
socket.on("users", (...args) => {
	$("#players").text(args[0].length);
});

// update online players every second
setInterval(() => {
	if (socket.connected) {
		socket.emit("req_users");
	}
}, 1000);


// event listeners
$("#board").on("touchmove touchend touchstart", (e) => {
	// prevent scroll while dragging pieces
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
		makeBestMove("w");
	}		
});
$("#undo").on("click", () => {
	let length = game.history().length;

	if (config.mode != "single" && length >= 1) {
		undo();
	} else if (length >= 2) {
		// undo twice (your move and your opponent's move)
		undo();
		undo();
	} else alert("Nothing to undo");
});
$("#redo").on("click", () => {
	let stack = config.undoStack;

	if (config.mode != "single" && stack.length >=1 ) {
		redo();
	} else if (stack.length >= 2) {
		// redo twice, same as undo
		redo();
		redo();
	} else alert("Nothing to redo");
});
$("#restart").on("click", () => {
	newGame();
	if (config.mode == "single" && config.color != "w")
		makeBestMove("w");
});
$("#menu-btn").on("click", () => {
	changeScreen("#menu-screen");
});
$("#save").on("click", () => {
	alert(`Game FEN String: <br/><br /><b>${game.fen()}</b><br /><br/>Please copy and save the text above.`, "Save");
});
$("#load").on("click", async () => {
	let fen = await prompt("Please enter a valid FEN string.", "", "Load");
	if (game.load(fen)) {
		resetBoard();
		if (config.mode == "single" && config.color != game.turn()) {
			makeBestMove(game.turn());
		}
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
	config.globalSum = 0;
	config.undoStack = [];
	board.position(game.fen(), false);
	removeHighlights();
	updateAdvantage();
	$("#status").html(`<b>${game.turn() == "w" ? "White": "Black"}</b> to move.`);
	$("#pgn").html("");
}

function undo() {
	let move = game.undo();
	config.undoStack.push(move);
	board.position(game.fen());
	showHint();
}

function redo() {
	game.move(config.undoStack.pop());
	board.position(game.fen());
	showHint();
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

function capitalize(str) {
	return str[0].toUpperCase() + str.slice(1);
}

function getStatusMessage(current, next) {
	if (game.in_checkmate())
		return `<b>Checkmate!</b> <b>${capitalize(current)}</b> won.`
	else if (game.insufficient_material())
		return `<b>Draw!</b> (Insufficient Material)`;
	else if (game.in_threefold_repetition())
		return `<b>Draw!</b> (Threefold Repetition)`;
	else if (game.in_stalemate())
		return `<b>Draw!</b> (Stalemate)`;
	else if (game.in_draw())
		return `<b>Draw!</b> (50-move Rule)`;
	else if (game.in_check())
		return `<b>${capitalize(next)}</b> to move, and is in <b>check!</b>`;
	else
		return `<b>${capitalize(next)}</b> to move.`;
}

function checkStatus(color) {
	let current = color == "w" ? "white" : "black";
	let next = color == "w" ? "black" : "white";
	let msg = getStatusMessage(current, next);

	$("#status").html(msg);

	if (game.game_over()) {
		alert(msg, "Game Over");
		return true;
	} else return false;
}

async function getBestMove(color) {
	let fen = game.fen().split(" ");
	fen[1] = color;
	fen = fen.join(" ");
	engine.write("position fen " + fen);

	let cmd = `go movetime ${config.searchTime}000`;
	let depth = config.searchDepth;
	if (depth != "0")
		cmd += " depth " + depth;

	engine.write(cmd);
	let move = (await engine.grep("bestmove")).split(" ")[1];

	return {
		from: move[0] + move[1],
		to: move[2] + move[3]
	};
}

async function showHint() {
	$("#board .square-55d63").removeClass('highlight-hint');

	if ($("#show-hint").is(":checked")) {
		let move = await getBestMove(config.color);
		$("#board .square-" + move.from).addClass('highlight-hint');
		$("#board .square-" + move.to).addClass('highlight-hint');
	}
}

async function makeBestMove(color) {
	let bestMove = await getBestMove(color);
	let move = makeMove(bestMove.from, bestMove.to, "q");
	if (move == null) {
		alert("An unexpected error occurred while moving for " + color, "Internel Error");
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

	config.globalSum = evaluateBoard(move, config.globalSum, "b");
	updateAdvantage();
	highlightMove(move);
	$("#pgn").text(game.pgn());

	return {
		...move,
		status: checkStatus(move.color)
	};
}

function onDrop(source, target) {
	config.undoStack = [];
	removeGreySquares();

	let move = makeMove(source, target, game.turn(), "q");
	if (move == null)
		return "snapback";

	if (!move.status && config.mode == "single") {
		makeBestMove(game.turn()).then(() => {
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
