import { game, evaluateBoard } from "./gamebase.js";
import { UCIEngine } from "./uciengine.js";
import { io } from "./lib/socket.io.esm.min.js";

(async () => {
// default error handler
window.onerror = (msg, src, lineno, colno, e) => {
	alert(msg, "Error");
};

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

// always hide game screen after chessboard init
// to get correct display dimension
$("#game-screen").css("display", "none");

// chessboard resize handler
$(window).on("resize", board.resize);

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
$("#show-hint").on("change", () => {
	showHint();
});

function changeScreen(id) {
	$(".screen").css("display", "none");
	$(id).css("display", "block");
}

function removeHighlights() {
	$("#board").find(".square-55d63").removeClass("highlight-white");
	$("#board").find(".square-55d63").removeClass("highlight-black");
	$("#board").find(".square-55d63").removeClass("highlight-hint");
}

function newGame() {
	game.reset();
	engine.write("ucinewgame");
	config.globalSum = 0;
	config.undoStack = [];
	board.position(game.fen());
	removeHighlights();
	$("#advantageColor").text("Neither side");
	$("#advantageNumber").text(0);
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
		style: `width: ${((-sum + 2000) / 4000) * 100}%`
	});
}

function checkStatus(color) {
	color = color == "w" ? "white" : "black";

	if (game.in_checkmate())
		$("#status").html(`<b>Checkmate!</b> Oops, <b>${color}</b> lost.`);
	else if (game.insufficient_material())
		$("#status").html(`It's a <b>draw!</b> (Insufficient Material)`);
	else if (game.in_threefold_repetition())
		$("#status").html(`It's a <b>draw!</b> (Threefold Repetition)`);
	else if (game.in_stalemate())
		$("#status").html(`It's a <b>draw!</b> (Stalemate)`);
	else if (game.in_draw())
		$("#status").html(`It's a <b>draw!</b> (50-move Rule)`);
	else if (game.in_check()) {
		$("#status").html(`Oops, <b>${color}</b> is in <b>check!</b>`);
		return false;
	} else {
		$("#status").html(`No check, checkmate, or draw.`);
		return false;
	}
	return true;
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
		to: move[2] + move[3],
		promotion: "q"
	};
}

async function showHint() {
	$("#board").find(".square-55d63").removeClass('highlight-hint');

	if ($("#show-hint").is(":checked")) {
		let move = await getBestMove(config.color);
		$("#board").find('.square-' + move.from).addClass('highlight-hint');
		$("#board").find('.square-' + move.to).addClass('highlight-hint');
	}
}

async function makeBestMove(color) {
	let move = game.move(await getBestMove(color));
	if (move == null) {
		alert("An unexpected error occurred while moving for " + color, "Internel Error");
		return;
	}

	board.position(game.fen());
	config.globalSum = evaluateBoard(move, config.globalSum, "b");
	updateAdvantage();
	checkStatus(color);
	highlightMove(move);
}

function highlightMove(move) {
	if (move.color == "b") {
		$("#board").find(".square-55d63").removeClass("highlight-black");
	  	$("#board").find(".square-" + move.from).addClass("highlight-black");
		$("#board").find(".square-" + move.to).addClass("highlight-black");
	} else {
		$("#board").find(".square-55d63").removeClass("highlight-white");
	  	$("#board").find(".square-" + move.from).addClass("highlight-white");
		$("#board").find(".square-" + move.to).addClass("highlight-white");
	}
}

function onDrop(source, target) {
	config.undoStack = [];
	removeGreySquares();

	let move = game.move({
		from: source,
		to: target,
		promotion: "q"
	});

	// illegal move
	if (move == null)
		return "snapback";
	
	config.globalSum = evaluateBoard(move, config.globalSum, "b");
	updateAdvantage();
	highlightMove(move);

	if (!checkStatus(move.color) && config.mode == "single") {
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

})();

(() => {
	function genCliId() {
		let str = "";
		for (let i = 0; i < 20; i++)
			str += Math.floor(Math.random() * 9);
		return str;
	}

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

	const timer = setInterval(() => {
		if (socket.connected) {
			socket.emit("req_users");
			socket.on("users", (...args) => {
				$("#players").text(args[0].length);
			});
		}
	}, 1000);
})();
