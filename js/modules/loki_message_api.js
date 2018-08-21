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

    function sendMessage(options)
    {
      return new Promise((resolve, reject) => {
        // const url = providedUrl || `${options.host}/${options.path}`;
        log.info(options.type, url);
        const timeout =
          typeof options.timeout !== 'undefined' ? options.timeout : 10000;
        
        body = JSON.stringify({
          pub_key: options.pub_key,
          message: options.data,
          ttl: options.ttl,
        })

        const fetchOptions = {
          method: 'PUT',
          body,
          headers: { 'X-Loki-Messenger-Agent': 'OWD' },
          timeout,
        };
    
        if (fetchOptions.body instanceof ArrayBuffer) {
          // node-fetch doesn't support ArrayBuffer, only node Buffer
          const contentLength = fetchOptions.body.byteLength;
          fetchOptions.body = Buffer.from(fetchOptions.body);
    
          // node-fetch doesn't set content-length like S3 requires
          fetchOptions.headers['Content-Length'] = contentLength;
        }
        fetchOptions.headers['Content-Type'] = 'application/json; charset=utf-8';

        fetch(url, fetchOptions)
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
              if (options.responseType === 'arraybuffer') {
                // eslint-disable-next-line no-param-reassign
                result = result.buffer.slice(
                  result.byteOffset,
                  result.byteOffset + result.byteLength
                );
              }
              if (options.responseType === 'json') {
                if (options.validateResponse) {
                  if (!_validateResponse(result, options.validateResponse)) {
                    log.error(options.type, url, response.status, 'Error');
                    reject(
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
                log.info(options.type, url, response.status, 'Success');
                resolve(result, response.status);
              } else {
                log.error(options.type, url, response.status, 'Error');
                reject(
                  HTTPError(
                    'promiseAjax: error response',
                    response.status,
                    result,
                    options.stack
                  )
                );
              }
            });
          })
          .catch(e => {
            log.error(options.type, url, 0, 'Error');
            const stack = `${e.stack}\nInitial stack:\n${options.stack}`;
            reject(HTTPError('promiseAjax catch', 0, e.toString(), stack));
          });
      });
    }
  }
}
