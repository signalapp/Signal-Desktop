const electron = require('electron');
const bunyan = require('bunyan');
const _ = require('lodash');


const ipc = electron.ipcRenderer;
const PHONE_REGEX = /\+\d{7,12}(\d{3})/g;
const GROUP_REGEX = /(group\()([^)]+)(\))/g;

// Default Bunyan levels: https://github.com/trentm/node-bunyan#levels
// To make it easier to visually scan logs, we make all levels the same length
const BLANK_LEVEL = '     ';
const LEVELS = {
  60: 'fatal',
  50: 'error',
  40: 'warn ',
  30: 'info ',
  20: 'debug',
  10: 'trace',
};


// Backwards-compatible logging, simple strings and no level (defaulted to INFO)

function redactPhone(text) {
  return text.replace(PHONE_REGEX, "+[REDACTED]$1");
}

function redactGroup(text) {
  return text.replace(GROUP_REGEX, function(match, before, id, after) {
    return before + '[REDACTED]' + id.slice(-3) + after;
  });
}

function now() {
  const date = new Date();
  return date.toJSON();
}

function log() {
  const args = Array.prototype.slice.call(arguments, 0);

  const consoleArgs = ['INFO ', now()].concat(args);
  console._log.apply(console, consoleArgs);

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
  const toSend = redactGroup(redactPhone(str.join(' ')));
  ipc.send('log-info', toSend);
}

if (window.console) {
  console._log = console.log;
  console.log = log;
}


// The mechanics of preparing a log for publish

function getHeader() {
  return window.navigator.userAgent + ' node/' + window.config.node_version;
}

function getLevel(level) {
  var text = LEVELS[level];
  if (!text) {
    return BLANK_LEVEL;
  }

  return text.toUpperCase();
}

function formatLine(entry) {
  return getLevel(entry.level) + ' ' + entry.time + ' ' + entry.msg;
}

function format(entries) {
  return redactGroup(redactPhone(entries.map(formatLine).join('\n')));
}

function fetch() {
  return getHeader() + '\n' + format(ipc.sendSync('fetch-log'));
}

function publish(log) {
  log = log || fetch();

  return new Promise(function(resolve) {
    const payload = textsecure.utils.jsonThing({
      files: {
        'debugLog.txt': {
          content: log
        }
      }
    });

    $.post('https://api.github.com/gists', payload)
      .then(function(response) {
        console._log('Posted debug log to ', response.html_url);
        resolve(response.html_url);
      })
      .fail(resolve);
  });
}


// A modern logging interface for the browser

// We create our own stream because we don't want to output JSON to the devtools console.
//   Anyway, the default process.stdout stream goes to the command-line, not the devtools.
const logger = bunyan.createLogger({
  name: 'log',
  streams: [{
    level: 'debug',
    stream: {
      write: function(entry) {
        console._log(formatLine(JSON.parse(entry)));
      }
    }
  }]
});

// The Bunyan API: https://github.com/trentm/node-bunyan#log-method-api
function logAtLevel() {
  const level = arguments[0];
  const args = Array.prototype.slice.call(arguments, 1);

  const ipcArgs = ['log-' + level].concat(args);
  ipc.send.apply(ipc, ipcArgs);

  logger[level].apply(logger, args);
}

window.log = {
  fatal: _.partial(logAtLevel, 'fatal'),
  error: _.partial(logAtLevel, 'error'),
  warn: _.partial(logAtLevel, 'warn'),
  info: _.partial(logAtLevel, 'info'),
  debug: _.partial(logAtLevel, 'debug'),
  trace: _.partial(logAtLevel, 'trace'),
  fetch,
  publish,
};

window.onerror = function(message, script, line, col, error) {
  log.error(error.stack);
};

