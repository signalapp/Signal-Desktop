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

    function sendMessage(pub_key, data, ttl)
    {
      const options = {
        url: `${url}/send_message`,
        type: 'PUT',
        responseType: undefined,
        timeout: undefined
      };

      return new Promise((resolve, reject) => {
        
        log.info(options.type, options.url);
        
        const body = JSON.stringify({
          pub_key,
          message: data,
          ttl,
        });

        const fetchOptions = {
          method: options.type,
          body,
          headers: { 'X-Loki-Messenger-Agent': 'OWD' },
          timeout: options.timeout,
        };

        fetchOptions.headers['Content-Type'] = 'application/json; charset=utf-8';

        fetch(options.url, fetchOptions)
          .then(response => {
            let resultPromise;
            if (
              options.responseType === 'json' &&
              response.headers.get('Content-Type') === 'application/json'
            ) {
              resultPromise = response.json();
            } else if (options.responseType === 'arraybuffer') {
              resultPromise = response.buffer();
            } else {
              resultPromise = response.text();
            }
            return resultPromise.then(result => {
              if (response.status >= 0 && response.status < 400) {
                log.info(options.type, options.url, response.status, 'Success');
                resolve(result, response.status);
              } else {
                log.error(options.type, options.url, response.status, 'Error');
                reject(
                  HTTPError(
                    'promiseAjax: error response',
                    response.status,
                    result
                  )
                );
              }
            });
          })
          .catch(e => {
            log.error(options.type, options.url, 0, 'Error');
            reject(HTTPError('promiseAjax catch', 0, e.toString()));
          });
      });
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