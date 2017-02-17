'use strict';

const path = require('path');

module.exports = function(grunt) {
  const nycPath = path.join(__dirname, 'node_modules', 'nyc', 'bin', 'nyc.js');

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    jshint: {
      options: {
        node: true,
        esnext: true,
        mocha: true,
        indent: 2,
        quotmark: 'single'
      },
      uses_defaults: ['lib/**/*.js', '*.js'],
      test_overrides: {
        options: {
          globals: {
            describe: true,
            it: true,
            before: true,
            beforeEach: true,
            after: true,
            afterEach: true
          },
        },
        files: {
          src: ['test/**/*.js', 'lib/**/*.js', '*.js', 'config/*.js', 'routes/*.js'],
        }
      }
    },
    run: {
      testsAndCoverage: {
        cmd: 'node',
        args: [
          nycPath,
          'npm',
          'test'
        ]
      }
    }
  });

  grunt.loadNpmTasks('grunt-run');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.registerTask('style', ['jshint']);
  grunt.registerTask('test', ['style', 'run:testsAndCoverage']);
  grunt.registerTask('default', ['start']);
};
