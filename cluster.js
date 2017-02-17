'use strict';

const _ = require('lodash');

const cluster = require('cluster');
const cpuCount = require('os').cpus().length;

function startWorkers() {
  for (let i = 0; i < cpuCount; ++i) {
    cluster.fork();
  }
}

function killWorkers() {
  _.each(cluster.workers, function(worker) {
    worker.removeAllListeners();
    worker.process.kill();
  });
}

if (cluster.isMaster) {
  // restart dead workers
  cluster.on('exit', function(worker) {
    console.log(`Worker ${worker.id} [${worker.process.pid}] died!`);
    cluster.fork();
  });

  // hup: restart all workers
  process.on('SIGHUP', function() {
    console.log('ttt-daemon: restarting all workers');
    killWorkers();
    startWorkers();
    console.log('ttt-daemon: restart complete');
  });

  // term: kill all workers
  process.on('SIGTERM', function() {
    console.log('ttt-daemon: shutting down all workers');
    killWorkers();
    console.log('ttt-daemon: shutting down');
  });

  try {
    console.log(`Cluster uid/gid: ${process.getuid()}/${process.getgid()}`);
    if (process.getuid() === 0) {
      console.log('Running as root; dropping privilege.');
      process.setgid('ttt');
      process.setuid('ttt');
      console.log(`Cluster uid/gid: ${process.getuid()}/${process.getgid()}`);
    }
  } catch(err) {
    console.log('Unable to write PIDfile: ', err);
    process.exit(1);
  }

  startWorkers();

} else {
  // load local environment config
  require('./worker');
  console.log(`Worker ${cluster.worker.id} [${cluster.worker.process.pid}] running!`);
}

