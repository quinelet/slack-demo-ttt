'use strict';

const setupUtils = require('../setupUtils.js');

const async = require('async');
const _ = require('lodash');
const expect = require('expect');
const langUtils = require('langUtils');
const Joi = require('joi');
const express = require('express');
const proxyquire = require('proxyquire');

const request = require('supertest');

const tttRoutes = require('../../routes/ttt');

describe('worker', function() {
  let server;
  before(function(cb) {
    // smuggle in a few extra test routes into ttt routes
    tttRoutes.get('/testRoutes/error', function(req, res, next) {
      next(new Error('detailed error text here'));
    });
    tttRoutes.get('/testRoutes/exportable_error', function(req, res, next) {
      const err = new Error('exportable error message');
      err.statusCode = 521;
      err.ttt_error = true;
      next(err);
    });
    tttRoutes.get('/testRoutes/generic_error', function(req, res, next) {
      const err = new Error();
      err.statusCode = 522;
      next(err);
    });

    server = proxyquire('../../worker', {
      './routes/ttt': tttRoutes,
      './config/config': require('../config/config')
    });
    cb();
  });

  it('provides status ok', function(cb) {
    request(server)
      .get('/status')
      .expect(200)
      .expect({ ttt: 'ok' }, cb);
  });

  it('unknown route 404', function(cb) {
    request(server)
      .get('/blah')
      .expect(404, cb);
  });

  it('sends custom errors', function(cb) {
    request(server)
      .get('/ttt/testRoutes/exportable_error')
      .end(function(err, res) {
        expect(err).toNotExist();
        expect(res.statusCode).toEqual(521);
        expect(res.text).toEqual('exportable error message');
        cb();
      });
  });

  it('sends generic errors', function(cb) {
    request(server)
      .get('/ttt/testRoutes/generic_error')
      .end(function(err, res) {
        expect(err).toNotExist();
        expect(res.statusCode).toEqual(500);
        expect(res.text).toEqual('Unspecified error');
        cb();
      });
  });

  it('eats detailed errors', function(cb) {
    request(server)
      .get('/ttt/testRoutes/error')
      .end(function(err, res) {
        expect(err).toNotExist();
        expect(res.statusCode).toEqual(500);
        expect(res.text).toEqual('Unspecified error');
        cb();
      });
  });
});
