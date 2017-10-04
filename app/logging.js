const path = require('path');
const fs = require('fs');

const electron = require('electron')
const bunyan = require('bunyan');
const mkdirp = require('mkdirp');
const _ = require('lodash');


const app = electron.app;
const ipc = electron.ipcMain;
const LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];

let logger;


function dropFirst(args) {
  return Array.prototype.slice.call(args, 1);
}

function initialize() {
  if (logger) {
    throw new Error('Already called initialize!');
  }

  const basePath = app.getPath('userData');
  const logPath = path.join(basePath, 'logs');
  mkdirp.sync(logPath);

  const logFile = path.join(logPath, 'log.log');

  logger = bunyan.createLogger({
    name: 'log',
    streams: [{
      level: 'debug',
      stream: process.stdout
    }, {
      type: 'rotating-file',
      path: logFile,
      period: '1d',
      count: 3
    }]
  });

  LEVELS.forEach(function(level) {
    ipc.on('log-' + level, function() {
      // first parameter is the event, rest are provided arguments
      var args = dropFirst(arguments);
      logger[level].apply(logger, args);
    });
  });

  ipc.on('fetch-log', function(event) {
    event.returnValue = fetch(logPath);
  });
}

function getLogger() {
  if (!logger) {
    throw new Error('Logger hasn\'t been initialized yet!');
  }

  return logger;
}

function fetch(logPath) {
  const files = fs.readdirSync(logPath);
  let contents = '';

  files.forEach(function(file) {
    contents += fs.readFileSync(path.join(logPath, file), { encoding: 'utf8' });
  });

  const lines = _.compact(contents.split('\n'));
  const data = _.compact(lines.map(function(line) {
    try {
      return JSON.parse(line);
    }
    catch (e) {}
  }));

  return _.sortBy(data, 'time');
}


function logAtLevel() {
  const level = arguments[0];
  const args = Array.prototype.slice.call(arguments, 1);

  if (logger) {
    // To avoid [Object object] in our log since console.log handles non-strings smoothly
    const str = args.map(function(item) {
      if (typeof item !== 'string') {
        try {
          return JSON.stringify(item);
        }
        catch (e) {
          return item;
        }
      }

      return item;
    });
    logger[level](str.join(' '));
  } else {
    console._log.apply(console, consoleArgs);
  }
}


console._log = console.log;
console.log = _.partial(logAtLevel, 'info');
console._error = console.error;
console.error = _.partial(logAtLevel, 'error');
console._warn = console.warn;
console.warn = _.partial(logAtLevel, 'warn');


module.exports = {
  initialize,
  getLogger,
};
