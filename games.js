import fs from "fs";
import log from "./log.js";
import { Chess } from "./static/lib/chess.js";

/**
 * @param {String} id 
 * @param {String} playerW 
 * @param {String} playerB 
 */
export function Game(id, playerW, playerB) {
	this.id = id;
	this.playerW = playerW;
	this.playerB = playerB;
	this.date = log.formatDate();
	this.fen = "";
	this.pgn = "";
	this.result = Game.RESULT_NULL;

	const chess = Chess();

	this.makeMove = (move) => {
		if (chess.move(move)) {
			this.fen = chess.fen();
			this.pgn = chess.pgn();
			
			if (chess.in_checkmate()) {
				this.result = Game.RESULT_CHECKMATE;
				return Game.MOVE_FINAL;
			} else if (chess.insufficient_material()) {
				this.result = Game.RESULT_DRAW_INSUFFICIENT_MATERIAL;
				return Game.MOVE_FINAL;
			} else if (chess.in_threefold_repetition()) {
				this.result = Game.RESULT_DRAW_THREEFOLD_REPETITION;
				return Game.MOVE_FINAL;
			} else if (chess.in_draw()) {
				this.result = Game.RESULT_DRAW_50_MOVE_RULE;
				return Game.MOVE_FINAL;
			} else {
				return Game.MOVE_NORMAL;
			}
		}
		return Game.MOVE_ILLEGAL;
	};
}

// static variables
Game.RESULT_CHECKMATE = 1;
Game.RESULT_DRAW_INSUFFICIENT_MATERIAL = 2;
Game.RESULT_DRAW_THREEFOLD_REPETITION = 3;
Game.RESULT_DRAW_50_MOVE_RULE = 4;
Game.RESULT_ABORTED = -1;
Game.RESULT_NULL = null;
Game.MOVE_FINAL = -1;
Game.MOVE_NORMAL = 1;
Game.MOVE_ILLEGAL = 0;

export function Games() {
	/**
	 * @type { Game[] }
	 */
	let games = [];

	/**
	 * @param {String} id
	 */
	let getItem = (id) => {
		for (let o of games) {
			if (o.id == id)
				return o;
		}
		return null;
	};

	/**
	 * @param {String} id 
	 */
	let removeItem = (id) => {
		for (let i in games) {
			if (games[i].id == id)
				games.splice(i, 1);
		}
	};

	this.getItem = getItem;
	this.removeItem = removeItem;

	/**
	 * @param {String} playerW 
	 * @param {String} playerB 
	 */
	this.newGame = (playerW, playerB) => {
		let game = new Game(Games.generateRandomId(), playerW, playerB);
		games.push(game);
		return game;
	};

	/**
	 * @param {String} playerId 
	 */
	this.getByPlayerId = (playerId) => {
		for (let g of games) {
			if (g.result == Game.RESULT_NULL && (g.playerW == playerId || g.playerB == playerId)) {
				return g;
			}
		}
		return null;
	};

	/**
	 * 
	 * @param {String} playerId 
	 * @param {String} opponentId 
	 * @param {String} color 
	 */
	this.getGame = (playerId, opponentId, color) => {
		let game = this.getByPlayerId(playerId);
		if (game != null)
			return game;

		if (color == "w") {
			return this.newGame(playerId, opponentId);
		} else {
			return this.newGame(opponentId, playerId);
		}
	};

	/**
	 * @param {String} playerId 
	 */
	this.disconnect = (playerId) => {
		let game = this.getByPlayerId(playerId);
		if (game != null && game.result == Game.RESULT_NULL) {
			game.result = Game.RESULT_ABORTED;
			return game;
		}
		return null;
	};
}

// static variables
Games.generateRandomId = () => {
	let str = "";
	for (let i = 0; i < 20; i++) {
		let ch = Math.floor(Math.random() * 20);
		str += String.fromCharCode(ch);
	}
	return str;
};
