'use strict';

const _ = require('lodash');

const GameModel = require('../model/GameModel');

const PRIVATE = 'private';
const PUBLIC = 'public';
const BOARD_ENTRIES = require('../definitions/GameDefinitions').BOARD_ENTRIES;
const GAME_OUTCOMES = require('../definitions/GameDefinitions').GAME_OUTCOMES;

const SlackMisc = require('./SlackMisc');

function UserMessage(game, text, privacy) {
  this.game = game;
  this.text = text;
  this.privacy = privacy || PRIVATE;
}

function sym(state) {
  switch(state) {
    case BOARD_ENTRIES.X:
      return 'X';
    case BOARD_ENTRIES.O:
      return 'O';
    default:
      return '.';
  }
}

function printBoard(game) {
  const firstPlayerDisplayUser = SlackMisc.getDisplayUser(game.players[GameModel.getFirstPlayerIndex(game)]);
  const secondPlayerDisplayUser = SlackMisc.getDisplayUser(game.players[GameModel.getSecondPlayerIndex(game)]);
  const statusText = (game.outcome === GAME_OUTCOMES.UNDECIDED) ?
    (`Move ${game.move}.\n` +
      `${SlackMisc.getDisplayUser(GameModel.getNextPlayer(game))} [${GameModel.isXTurn(game) ? 'X' : 'O'}] is next.\n`) :
    (GameModel.isXTurn(game) ?
      `${secondPlayerDisplayUser} [O] won.` :
      `${firstPlayerDisplayUser} [X] won.`);
  return '\n```\n' +
    `${firstPlayerDisplayUser} v. ${secondPlayerDisplayUser}\n` +
    `${statusText}\n` +
    '-------------\n' +
    `| ${sym(game.board[0][0])} | ${sym(game.board[1][0])} | ${sym(game.board[2][0])} |\n` +
    '-------------\n' +
    `| ${sym(game.board[0][1])} | ${sym(game.board[1][1])} | ${sym(game.board[2][1])} |\n` +
    '-------------\n' +
    `| ${sym(game.board[0][2])} | ${sym(game.board[1][2])} | ${sym(game.board[2][2])} |\n` +
    '-------------\n```';
}

UserMessage.prototype.getSlackMessage = function() {
  return {
    response_type: this.privacy === PRIVATE ? 'ephemeral' : 'in_channel',
    text: this.text + (this.game ? printBoard(this.game) : '')
  };
};

module.exports = {
  UserMessage: UserMessage,
  PUBLIC: PUBLIC,
  PRIVATE: PRIVATE
};