/* global nodeBuffer: false */
/* global nodeWebSocket: false */
/* global nodeFetch: false */
/* global nodeSetImmediate: false */
/* global ProxyAgent: false */

/* global window: false */
/* global getString: false */
/* global btoa: false */
/* global StringView: false */
/* global textsecure: false */

/* eslint-disable more/no-then */

// eslint-disable-next-line no-unused-vars, func-names
const TextSecureServer = (function() {
  function validateResponse(response, schema) {
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

  function createSocket(url) {
    const { proxyUrl } = window.config;
    let requestOptions;
    if (proxyUrl) {
      requestOptions = {
        ca: window.config.certificateAuthorities,
        agent: new ProxyAgent(proxyUrl),
      };
    } else {
      requestOptions = {
        ca: window.config.certificateAuthorities,
      };
    }

    // eslint-disable-next-line new-cap
    return new nodeWebSocket(url, null, null, null, requestOptions);
  }

  // We add this to window here because the default Node context is erased at the end
  //   of preload.js processing
  window.setImmediate = nodeSetImmediate;

  function promiseAjax(providedUrl, options) {
    return new Promise((resolve, reject) => {
      const url = providedUrl || `${options.host}/${options.path}`;
      console.log(options.type, url);
      const timeout =
        typeof options.timeout !== 'undefined' ? options.timeout : 10000;

      const { proxyUrl } = window.config;
      let agent;
      if (proxyUrl) {
        agent = new ProxyAgent(proxyUrl);
      }

      const fetchOptions = {
        method: options.type,
        body: options.data || null,
        headers: { 'X-Signal-Agent': 'OWD' },
        agent,
        ca: options.certificateAuthorities,
        timeout,
      };

      if (fetchOptions.body instanceof ArrayBuffer) {
        // node-fetch doesn't support ArrayBuffer, only node Buffer
        const contentLength = fetchOptions.body.byteLength;
        fetchOptions.body = nodeBuffer.from(fetchOptions.body);

        // node-fetch doesn't set content-length like S3 requires
        fetchOptions.headers['Content-Length'] = contentLength;
      }

      if (options.user && options.password) {
        const user = getString(options.user);
        const password = getString(options.password);
        const auth = btoa(`${user}:${password}`);
        fetchOptions.headers.Authorization = `Basic ${auth}`;
      }
      if (options.contentType) {
        fetchOptions.headers['Content-Type'] = options.contentType;
      }
      nodeFetch(url, fetchOptions)
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
                if (!validateResponse(result, options.validateResponse)) {
                  console.log(options.type, url, response.status, 'Error');
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
              console.log(options.type, url, response.status, 'Success');
              resolve(result, response.status);
            } else {
              console.log(options.type, url, response.status, 'Error');
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
          console.log(options.type, url, 0, 'Error');
          const stack = `${e.stack}\nInitial stack:\n${options.stack}`;
          reject(HTTPError('promiseAjax catch', 0, e.toString(), stack));
        });
    });
  }

  function retryAjax(url, options, providedLimit, providedCount) {
    const count = (providedCount || 0) + 1;
    const limit = providedLimit || 3;
    return promiseAjax(url, options).catch(e => {
      if (e.name === 'HTTPError' && e.code === -1 && count < limit) {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(retryAjax(url, options, limit, count));
          }, 1000);
        });
      }
      throw e;
    });
  }

  function ajax(url, options) {
    // eslint-disable-next-line no-param-reassign
    options.stack = new Error().stack; // just in case, save stack here.
    return retryAjax(url, options);
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

  const URL_CALLS = {
    accounts: 'v1/accounts',
    devices: 'v1/devices',
    keys: 'v2/keys',
    signed: 'v2/keys/signed',
    messages: 'v1/messages',
    attachment: 'v1/attachments',
    profile: 'v1/profile',
  };

  // eslint-disable-next-line no-shadow
  function TextSecureServer(url, username, password, cdnUrl) {
    if (typeof url !== 'string') {
      throw new Error('Invalid server url');
    }
    this.url = url;
    this.cdnUrl = cdnUrl;
    this.username = username;
    this.password = password;
  }

  TextSecureServer.prototype = {
    constructor: TextSecureServer,
    ajax(param) {
      if (!param.urlParameters) {
        // eslint-disable-next-line no-param-reassign
        param.urlParameters = '';
      }
      return ajax(null, {
        host: this.url,
        path: URL_CALLS[param.call] + param.urlParameters,
        type: param.httpType,
        data: param.jsonData && textsecure.utils.jsonThing(param.jsonData),
        contentType: 'application/json; charset=utf-8',
        responseType: param.responseType,
        user: this.username,
        password: this.password,
        validateResponse: param.validateResponse,
        certificateAuthorities: window.config.certificateAuthorities,
        timeout: param.timeout,
      }).catch(e => {
        const { code } = e;
        if (code === 200) {
          // happens sometimes when we get no response
          // (TODO: Fix server to return 204? instead)
          return null;
        }
        let message;
        switch (code) {
          case -1:
            message =
              'Failed to connect to the server, please check your network connection.';
            break;
          case 413:
            message = 'Rate limit exceeded, please try again later.';
            break;
          case 403:
            message = 'Invalid code, please try again.';
            break;
          case 417:
            // TODO: This shouldn't be a thing?, but its in the API doc?
            message = 'Number already registered.';
            break;
          case 401:
            message =
              'Invalid authentication, most likely someone re-registered and invalidated our registration.';
            break;
          case 404:
            message = 'Number is not registered.';
            break;
          default:
            message =
              'The server rejected our query, please file a bug report.';
        }
        e.message = message;
        throw e;
      });
    },
    getProfile(number) {
      return this.ajax({
        call: 'profile',
        httpType: 'GET',
        urlParameters: `/${number}`,
        responseType: 'json',
      });
    },
    getAvatar(path) {
      return ajax(`${this.cdnUrl}/${path}`, {
        type: 'GET',
        responseType: 'arraybuffer',
        contentType: 'application/octet-stream',
        certificateAuthorities: window.config.certificateAuthorities,
        timeout: 0,
      });
    },
    requestVerificationSMS(number) {
      return this.ajax({
        call: 'accounts',
        httpType: 'GET',
        urlParameters: `/sms/code/${number}`,
      });
    },
    requestVerificationVoice(number) {
      return this.ajax({
        call: 'accounts',
        httpType: 'GET',
        urlParameters: `/voice/code/${number}`,
      });
    },
    confirmCode(
      number,
      code,
      password,
      signalingKey,
      registrationId,
      deviceName
    ) {
      const jsonData = {
        signalingKey: btoa(getString(signalingKey)),
        supportsSms: false,
        fetchesMessages: true,
        registrationId,
      };

      let call;
      let urlPrefix;
      let schema;
      let responseType;

      if (deviceName) {
        jsonData.name = deviceName;
        call = 'devices';
        urlPrefix = '/';
        schema = { deviceId: 'number' };
        responseType = 'json';
      } else {
        call = 'accounts';
        urlPrefix = '/code/';
      }

      this.username = number;
      this.password = password;
      return this.ajax({
        call,
        httpType: 'PUT',
        urlParameters: urlPrefix + code,
        jsonData,
        responseType,
        validateResponse: schema,
      });
    },
    getDevices() {
      return this.ajax({
        call: 'devices',
        httpType: 'GET',
      });
    },
    registerKeys(genKeys) {
      const keys = {};
      keys.identityKey = btoa(getString(genKeys.identityKey));
      keys.signedPreKey = {
        keyId: genKeys.signedPreKey.keyId,
        publicKey: btoa(getString(genKeys.signedPreKey.publicKey)),
        signature: btoa(getString(genKeys.signedPreKey.signature)),
      };

      keys.preKeys = [];
      let j = 0;
      // eslint-disable-next-line guard-for-in, no-restricted-syntax
      for (const i in genKeys.preKeys) {
        keys.preKeys[j] = {
          keyId: genKeys.preKeys[i].keyId,
          publicKey: btoa(getString(genKeys.preKeys[i].publicKey)),
        };
        j += 1;
      }

      // This is just to make the server happy
      // (v2 clients should choke on publicKey)
      keys.lastResortKey = { keyId: 0x7fffffff, publicKey: btoa('42') };

      return this.ajax({
        call: 'keys',
        httpType: 'PUT',
        jsonData: keys,
      });
    },
    setSignedPreKey(signedPreKey) {
      return this.ajax({
        call: 'signed',
        httpType: 'PUT',
        jsonData: {
          keyId: signedPreKey.keyId,
          publicKey: btoa(getString(signedPreKey.publicKey)),
          signature: btoa(getString(signedPreKey.signature)),
        },
      });
    },
    getMyKeys() {
      return this.ajax({
        call: 'keys',
        httpType: 'GET',
        responseType: 'json',
        validateResponse: { count: 'number' },
      }).then(res => res.count);
    },
    getKeysForNumber(number, deviceId = '*') {
      return this.ajax({
        call: 'keys',
        httpType: 'GET',
        urlParameters: `/${number}/${deviceId}`,
        responseType: 'json',
        validateResponse: { identityKey: 'string', devices: 'object' },
      }).then(res => {
        if (res.devices.constructor !== Array) {
          throw new Error('Invalid response');
        }
        res.identityKey = StringView.base64ToBytes(res.identityKey);
        res.devices.forEach(device => {
          if (
            !validateResponse(device, { signedPreKey: 'object' }) ||
            !validateResponse(device.signedPreKey, {
              publicKey: 'string',
              signature: 'string',
            })
          ) {
            throw new Error('Invalid signedPreKey');
          }
          if (device.preKey) {
            if (
              !validateResponse(device, { preKey: 'object' }) ||
              !validateResponse(device.preKey, { publicKey: 'string' })
            ) {
              throw new Error('Invalid preKey');
            }
            // eslint-disable-next-line no-param-reassign
            device.preKey.publicKey = StringView.base64ToBytes(
              device.preKey.publicKey
            );
          }
          // eslint-disable-next-line no-param-reassign
          device.signedPreKey.publicKey = StringView.base64ToBytes(
            device.signedPreKey.publicKey
          );
          // eslint-disable-next-line no-param-reassign
          device.signedPreKey.signature = StringView.base64ToBytes(
            device.signedPreKey.signature
          );
        });
        return res;
      });
    },
    sendMessages(destination, messageArray, timestamp, silent) {
      const jsonData = { messages: messageArray, timestamp };

      if (silent) {
        jsonData.silent = true;
      }

      return this.ajax({
        call: 'messages',
        httpType: 'PUT',
        urlParameters: `/${destination}`,
        jsonData,
        responseType: 'json',
      });
    },
    getAttachment(id) {
      return this.ajax({
        call: 'attachment',
        httpType: 'GET',
        urlParameters: `/${id}`,
        responseType: 'json',
        validateResponse: { location: 'string' },
      }).then(response =>
        ajax(response.location, {
          timeout: 0,
          type: 'GET',
          responseType: 'arraybuffer',
          contentType: 'application/octet-stream',
        })
      );
    },
    putAttachment(encryptedBin) {
      return this.ajax({
        call: 'attachment',
        httpType: 'GET',
        responseType: 'json',
      }).then(response =>
        ajax(response.location, {
          timeout: 0,
          type: 'PUT',
          contentType: 'application/octet-stream',
          data: encryptedBin,
          processData: false,
        }).then(() => response.idString)
      );
    },
    getMessageSocket() {
      console.log('opening message socket', this.url);
      const fixedScheme = this.url
        .replace('https://', 'wss://')
        .replace('http://', 'ws://');
      const login = encodeURIComponent(this.username);
      const password = encodeURIComponent(this.password);

      return createSocket(
        `${fixedScheme}/v1/websocket/?login=${login}&password=${password}&agent=OWD`
      );
    },
    getProvisioningSocket() {
      console.log('opening provisioning socket', this.url);
      const fixedScheme = this.url
        .replace('https://', 'wss://')
        .replace('http://', 'ws://');

      return createSocket(
        `${fixedScheme}/v1/websocket/provisioning/?agent=OWD`
      );
    },
  };

  return TextSecureServer;
})();
