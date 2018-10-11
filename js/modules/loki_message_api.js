const fetch = require('node-fetch');
const is = require('@sindresorhus/is');

module.exports = {
  initialize,
};

function initialize({ url }) {
  if (!is.string(url)) {
    throw new Error('WebAPI.initialize: Invalid server url');
  }

  return {
    connect,
  };

  function connect() {
    return {
      sendMessage
    };

    async function sendMessage(pub_key, data, ttl)
    {
      const options = {
        url: `${url}/send_message`,
        type: 'POST',
        responseType: undefined,
        timeout: undefined
      };
        
      log.info(options.type, options.url);


      const fetchOptions = {
        method: options.type,
        body: data,
        headers: {
          'X-Loki-ttl': ttl,
          'X-Loki-recipient': pub_key,
          'Content-Length': data.byteLength,
        },
        timeout: options.timeout,
      };

      let response;
      try {
        response = await fetch(options.url, fetchOptions);
      }
      catch(e) {
        log.error(options.type, options.url, 0, 'Error');
        throw HTTPError('fetch error', 0, e.toString());
      }

      let result;
      if (
        options.responseType === 'json' &&
        response.headers.get('Content-Type') === 'application/json'
      ) {
        result = await response.json();
      } else if (options.responseType === 'arraybuffer') {
        result = await response.buffer();
      } else {
        result = await response.text();
      }

      if (response.status >= 0 && response.status < 400) {
        log.info(options.type, options.url, response.status, 'Success');
        return [result, response.status];
      } else {
        log.error(options.type, options.url, response.status, 'Error');
        throw HTTPError(
          'sendMessage: error response',
          response.status,
          result
        );
      }
    }
  }
}

function HTTPError(message, providedCode, response, stack) {
  const code = providedCode > 999 || providedCode < 100 ? -1 : providedCode;
  const e = new Error(`${message}; code: ${code}`);
  e.name = 'HTTPError';
  e.code = code;
  if (stack) {
    e.stack += `\nOriginal stack:\n${stack}`;
  }
  if (response) {
    e.response = response;
  }
  return e;
}