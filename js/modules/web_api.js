const fetch = require('node-fetch');
const { Agent } = require('https');

/* global Buffer, setTimeout, log, _ */

/* eslint-disable more/no-then, no-bitwise, no-nested-ternary */

function _btoa(str) {
  let buffer;

  if (str instanceof Buffer) {
    buffer = str;
  } else {
    buffer = Buffer.from(str.toString(), 'binary');
  }

  return buffer.toString('base64');
}

const _call = object => Object.prototype.toString.call(object);

const ArrayBufferToString = _call(new ArrayBuffer());
const Uint8ArrayToString = _call(new Uint8Array());

function _getString(thing) {
  if (typeof thing !== 'string') {
    if (_call(thing) === Uint8ArrayToString) {
      return String.fromCharCode.apply(null, thing);
    }
    if (_call(thing) === ArrayBufferToString) {
      return _getString(new Uint8Array(thing));
    }
  }
  return thing;
}

function _validateResponse(response, schema) {
  try {
    // eslint-disable-next-line guard-for-in, no-restricted-syntax
    for (const i in schema) {
      switch (schema[i]) {
        case 'object':
        case 'string':
        case 'number':
          // eslint-disable-next-line valid-typeof
          if (typeof response[i] !== schema[i]) {
            return false;
          }
          break;
        default:
      }
    }
  } catch (ex) {
    return false;
  }
  return true;
}

const FIVE_MINUTES = 1000 * 60 * 5;
const agents = {
  unauth: null,
  auth: null,
};

function getContentType(response) {
  if (response.headers && response.headers.get) {
    return response.headers.get('content-type');
  }

  return null;
}

function _promiseAjax(providedUrl, options) {
  return new Promise((resolve, reject) => {
    const url = providedUrl || `${options.host}/${options.path}`;
    if (options.disableLogs) {
      log.info(
        `${options.type} [REDACTED_URL]${
          options.unauthenticated ? ' (unauth)' : ''
        }`
      );
    } else {
      log.info(
        `${options.type} ${url}${options.unauthenticated ? ' (unauth)' : ''}`
      );
    }

    const timeout =
      typeof options.timeout !== 'undefined' ? options.timeout : 10000;

    const { proxyUrl } = options;
    const agentType = options.unauthenticated ? 'unauth' : 'auth';
    const cacheKey = `${proxyUrl}-${agentType}`;

    const { timestamp } = agents[cacheKey] || {};
    if (!timestamp || timestamp + FIVE_MINUTES < Date.now()) {
      if (timestamp) {
        log.info(`Cycling agent for type ${cacheKey}`);
      }
      agents[cacheKey] = {
        agent: new Agent({ keepAlive: true }),
        timestamp: Date.now(),
      };
    }
    const { agent } = agents[cacheKey];

    const fetchOptions = {
      method: options.type,
      body: options.data || null,
      headers: {
        'User-Agent': 'Session',
        'X-Loki-Messenger-Agent': 'OWD',
        ...options.headers,
      },
      redirect: options.redirect,
      agent,
      ca: options.certificateAuthority,
      timeout,
    };

    if (fetchOptions.body instanceof ArrayBuffer) {
      // node-fetch doesn't support ArrayBuffer, only node Buffer
      const contentLength = fetchOptions.body.byteLength;
      fetchOptions.body = Buffer.from(fetchOptions.body);

      // node-fetch doesn't set content-length like S3 requires
      fetchOptions.headers['Content-Length'] = contentLength;
    }

    const { accessKey, unauthenticated } = options;
    if (unauthenticated) {
      if (!accessKey) {
        throw new Error(
          '_promiseAjax: mode is aunathenticated, but accessKey was not provided'
        );
      }
      // Access key is already a Base64 string
      fetchOptions.headers['Unidentified-Access-Key'] = accessKey;
    } else if (options.user && options.password) {
      const user = _getString(options.user);
      const password = _getString(options.password);
      const auth = _btoa(`${user}:${password}`);
      fetchOptions.headers.Authorization = `Basic ${auth}`;
    }

    if (options.contentType) {
      fetchOptions.headers['Content-Type'] = options.contentType;
    }

    fetch(url, fetchOptions)
      .then(response => {
        let resultPromise;
        if (
          options.responseType === 'json' &&
          response.headers.get('Content-Type') === 'application/json'
        ) {
          resultPromise = response.json();
        } else if (
          options.responseType === 'arraybuffer' ||
          options.responseType === 'arraybufferwithdetails'
        ) {
          resultPromise = response.buffer();
        } else {
          resultPromise = response.text();
        }

        return resultPromise.then(result => {
          if (
            options.responseType === 'arraybuffer' ||
            options.responseType === 'arraybufferwithdetails'
          ) {
            // eslint-disable-next-line no-param-reassign
            result = result.buffer.slice(
              result.byteOffset,
              result.byteOffset + result.byteLength
            );
          }
          if (options.responseType === 'json') {
            if (options.validateResponse) {
              if (!_validateResponse(result, options.validateResponse)) {
                if (options.disableLogs) {
                  log.info(
                    options.type,
                    '[REDACTED_URL]',
                    response.status,
                    'Error'
                  );
                } else {
                  log.error(options.type, url, response.status, 'Error');
                }
                return reject(
                  HTTPError(
                    'promiseAjax: invalid response',
                    response.status,
                    result,
                    options.stack
                  )
                );
              }
            }
          }
          if (response.status >= 0 && response.status < 400) {
            if (options.disableLogs) {
              log.info(
                options.type,
                '[REDACTED_URL]',
                response.status,
                'Success'
              );
            } else {
              log.info(options.type, url, response.status, 'Success');
            }
            if (options.responseType === 'arraybufferwithdetails') {
              return resolve({
                data: result,
                contentType: getContentType(response),
                response,
              });
            }
            return resolve(result, response.status);
          }

          if (options.disableLogs) {
            log.info(options.type, '[REDACTED_URL]', response.status, 'Error');
          } else {
            log.error(options.type, url, response.status, 'Error');
          }
          return reject(
            HTTPError(
              'promiseAjax: error response',
              response.status,
              result,
              options.stack
            )
          );
        });
      })
      .catch(e => {
        if (options.disableLogs) {
          log.error(options.type, '[REDACTED_URL]', 0, 'Error');
        } else {
          log.error(options.type, url, 0, 'Error');
        }
        const stack = `${e.stack}\nInitial stack:\n${options.stack}`;
        reject(HTTPError('promiseAjax catch', 0, e.toString(), stack));
      });
  });
}

function _retryAjax(url, options, providedLimit, providedCount) {
  const count = (providedCount || 0) + 1;
  const limit = providedLimit || 3;
  return _promiseAjax(url, options).catch(e => {
    if (e.name === 'HTTPError' && e.code === -1 && count < limit) {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(_retryAjax(url, options, limit, count));
        }, 1000);
      });
    }
    throw e;
  });
}

function _outerAjax(url, options) {
  // eslint-disable-next-line no-param-reassign
  options.stack = new Error().stack; // just in case, save stack here.
  return _retryAjax(url, options);
}

function HTTPError(message, providedCode, response, stack) {
  const code = providedCode > 999 || providedCode < 100 ? -1 : providedCode;
  const e = new Error(`${message}; code: ${code}`);
  e.name = 'HTTPError';
  e.code = code;
  e.stack += `\nOriginal stack:\n${stack}`;
  if (response) {
    e.response = response;
  }
  return e;
}

module.exports = {
  initialize,
};

// We first set up the data that won't change during this session of the app
function initialize() {
  // Thanks to function-hoisting, we can put this return statement before all of the
  //   below function definitions.
  return {
    connect,
  };

  // Then we connect to the server with user-specific information. This is the only API
  //   exposed to the browser context, ensuring that it can't connect to arbitrary
  //   locations.
  function connect() {
    // Thanks, function hoisting!
    return {
      getAttachment,
      getProxiedSize,
      makeProxiedRequest,
    };

    function getAttachment(fileUrl) {
      return _outerAjax(fileUrl, {
        contentType: 'application/octet-stream',
        responseType: 'arraybuffer',
        timeout: 0,
        type: 'GET',
      });
    }

    // eslint-disable-next-line no-shadow
    async function getProxiedSize(url) {
      const result = await _outerAjax(url, {
        processData: false,
        responseType: 'arraybufferwithdetails',
        proxyUrl: '',
        type: 'HEAD',
        disableLogs: true,
      });

      const { response } = result;
      if (!response.headers || !response.headers.get) {
        throw new Error('getProxiedSize: Problem retrieving header value');
      }

      const size = response.headers.get('content-length');
      return parseInt(size, 10);
    }

    // eslint-disable-next-line no-shadow
    function makeProxiedRequest(url, options = {}) {
      const { returnArrayBuffer, start, end } = options;
      let headers;

      if (_.isNumber(start) && _.isNumber(end)) {
        headers = {
          Range: `bytes=${start}-${end}`,
        };
      }

      return _outerAjax(url, {
        processData: false,
        responseType: returnArrayBuffer ? 'arraybufferwithdetails' : null,
        proxyUrl: '',
        type: 'GET',
        redirect: 'follow',
        disableLogs: true,
        headers,
      });
    }
  }
}
