'use strict';

const async = require('async');
const _ = require('lodash');
const expect = require('expect');
const langUtils = require('langUtils');
const Joi = require('joi');

const GameFactory = require('../factory/GameFactory');
const BOARD_ENTRIES = require('../../lib/definitions/GameDefinitions').BOARD_ENTRIES;
const O = BOARD_ENTRIES.O;
const X = BOARD_ENTRIES.X;
const C = BOARD_ENTRIES.CLEAR;

const UserMessage = require('../../lib/util/UserMessage');

describe('UserMessage', function() {
  describe('construct', function() {
    it('constructs private messages', function(cb) {
      const um1 = new UserMessage.UserMessage(null, 'test message1', UserMessage.PRIVATE);
      const um2 = new UserMessage.UserMessage(null, 'test message2');
      expect(um1.text).toContain('test message1');
      expect(um2.text).toContain('test message2');
      expect(um1.privacy).toEqual('private');
      expect(um2.privacy).toEqual('private');
      cb();
    });
    it('constructs public messages', function(cb) {
      const um3 = new UserMessage.UserMessage(null, 'test message3', UserMessage.PUBLIC);
      expect(um3.text).toContain('test message3');
      expect(um3.privacy).toEqual('public');
      cb();
    });
  });
  describe('getSlackMessage', function() {
    const game = GameFactory.makeGame('p1', 'p2', 'test_util_message',
      [[X, C, O], [C, X, C], [O, C, C]]
    );

    it('returns slack message with board', function(cb) {
      const um4 = new UserMessage.UserMessage(game, 'test message4', UserMessage.PUBLIC);
      const message = um4.getSlackMessage();
      expect(message.text).toContain('test message4');
      expect(message.response_type).toEqual('in_channel');
      expect(message.text).toContain('| . | X | . |');
      cb();
    });

    it('returns slack message without board', function(cb) {
      const um5 = new UserMessage.UserMessage(null, 'test message5', UserMessage.PRIVATE);
      const message = um5.getSlackMessage();
      expect(message.response_type).toEqual('ephemeral');
      expect(message.attachment).toNotExist();
      cb();
    });
  });
});

