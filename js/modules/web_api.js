const WebSocket = require('websocket').w3cwebsocket;
const fetch = require('node-fetch');
const ProxyAgent = require('proxy-agent');
const { Agent } = require('https');
const FormData = require('form-data');

const is = require('@sindresorhus/is');

/* global Buffer, setTimeout, log, _, lokiFileServerAPI */

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

function _b64ToUint6(nChr) {
  return nChr > 64 && nChr < 91
    ? nChr - 65
    : nChr > 96 && nChr < 123
      ? nChr - 71
      : nChr > 47 && nChr < 58
        ? nChr + 4
        : nChr === 43
          ? 62
          : nChr === 47
            ? 63
            : 0;
}

function _getStringable(thing) {
  return (
    typeof thing === 'string' ||
    typeof thing === 'number' ||
    typeof thing === 'boolean' ||
    (thing === Object(thing) &&
      (_call(thing) === ArrayBufferToString ||
        _call(thing) === Uint8ArrayToString))
  );
}

function _ensureStringed(thing) {
  if (_getStringable(thing)) {
    return _getString(thing);
  } else if (thing instanceof Array) {
    const res = [];
    for (let i = 0; i < thing.length; i += 1) {
      res[i] = _ensureStringed(thing[i]);
    }
    return res;
  } else if (thing === Object(thing)) {
    const res = {};
    // eslint-disable-next-line guard-for-in, no-restricted-syntax
    for (const key in thing) {
      res[key] = _ensureStringed(thing[key]);
    }
    return res;
  } else if (thing === null) {
    return null;
  } else if (thing === undefined) {
    return undefined;
  }
  throw new Error(`unsure of how to jsonify object of type ${typeof thing}`);
}

function _jsonThing(thing) {
  return JSON.stringify(_ensureStringed(thing));
}

function _base64ToBytes(sBase64, nBlocksSize) {
  const sB64Enc = sBase64.replace(/[^A-Za-z0-9+/]/g, '');
  const nInLen = sB64Enc.length;
  const nOutLen = nBlocksSize
    ? Math.ceil(((nInLen * 3 + 1) >> 2) / nBlocksSize) * nBlocksSize
    : (nInLen * 3 + 1) >> 2;
  const aBBytes = new ArrayBuffer(nOutLen);
  const taBytes = new Uint8Array(aBBytes);

  for (
    let nMod3, nMod4, nUint24 = 0, nOutIdx = 0, nInIdx = 0;
    nInIdx < nInLen;
    nInIdx += 1
  ) {
    nMod4 = nInIdx & 3;
    nUint24 |= _b64ToUint6(sB64Enc.charCodeAt(nInIdx)) << (18 - 6 * nMod4);
    if (nMod4 === 3 || nInLen - nInIdx === 1) {
      for (
        nMod3 = 0;
        nMod3 < 3 && nOutIdx < nOutLen;
        nMod3 += 1, nOutIdx += 1
      ) {
        taBytes[nOutIdx] = (nUint24 >>> ((16 >>> nMod3) & 24)) & 255;
      }
      nUint24 = 0;
    }
  }
  return aBBytes;
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

function _createSocket(url, { certificateAuthority, proxyUrl, signature }) {
  let requestOptions;
  if (proxyUrl) {
    requestOptions = {
      ca: certificateAuthority,
      agent: new ProxyAgent(proxyUrl),
    };
  } else {
    requestOptions = {
      ca: certificateAuthority,
    };
  }
  // TODO: sign a timestamp
  let headers;
  if (signature) {
    headers = {
      signature,
    };
  }

  // eslint-disable-next-line new-cap
  return new WebSocket(url, null, null, headers, requestOptions);
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
        agent: proxyUrl
          ? new ProxyAgent(proxyUrl)
          : new Agent({ keepAlive: true }),
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

const URL_CALLS = {
  accounts: 'v1/accounts',
  updateDeviceName: 'v1/accounts/name',
  removeSignalingKey: 'v1/accounts/signaling_key',
  attachment: 'v1/attachments',
  deliveryCert: 'v1/certificate/delivery',
  supportUnauthenticatedDelivery: 'v1/devices/unauthenticated_delivery',
  devices: 'v1/devices',
  keys: 'v2/keys',
  messages: 'v1/messages',
  profile: 'v1/profile',
  signed: 'v2/keys/signed',
};

module.exports = {
  initialize,
};

// We first set up the data that won't change during this session of the app
function initialize({
  url,
  cdnUrl,
  certificateAuthority,
  contentProxyUrl,
  proxyUrl,
}) {
  if (!is.string(url)) {
    throw new Error('WebAPI.initialize: Invalid server url');
  }
  if (!is.string(cdnUrl)) {
    throw new Error('WebAPI.initialize: Invalid cdnUrl');
  }
  if (!is.string(certificateAuthority)) {
    throw new Error('WebAPI.initialize: Invalid certificateAuthority');
  }
  if (!is.string(contentProxyUrl)) {
    throw new Error('WebAPI.initialize: Invalid contentProxyUrl');
  }

  // Thanks to function-hoisting, we can put this return statement before all of the
  //   below function definitions.
  return {
    connect,
  };

  // Then we connect to the server with user-specific information. This is the only API
  //   exposed to the browser context, ensuring that it can't connect to arbitrary
  //   locations.
  function connect({ username: initialUsername, password: initialPassword }) {
    let username = initialUsername;
    let password = initialPassword;

    // Thanks, function hoisting!
    return {
      confirmCode,
      getAttachment,
      getAvatar,
      getDevices,
      getKeysForNumber,
      getKeysForNumberUnauth,
      getMessageSocket,
      getMyKeys,
      getProfile,
      getProfileUnauth,
      getProvisioningSocket,
      getProxiedSize,
      getSenderCertificate,
      makeProxiedRequest,
      putAttachment,
      putAvatar,
      registerKeys,
      registerSupportForUnauthenticatedDelivery,
      removeSignalingKey,
      requestVerificationSMS,
      requestVerificationVoice,
      sendMessages,
      sendMessagesUnauth,
      setSignedPreKey,
      updateDeviceName,
    };

    function _ajax(param) {
      if (!param.urlParameters) {
        // eslint-disable-next-line no-param-reassign
        param.urlParameters = '';
      }
      return _outerAjax(null, {
        certificateAuthority,
        contentType: 'application/json; charset=utf-8',
        data: param.jsonData && _jsonThing(param.jsonData),
        host: url,
        password,
        path: URL_CALLS[param.call] + param.urlParameters,
        proxyUrl,
        responseType: param.responseType,
        timeout: param.timeout,
        type: param.httpType,
        user: username,
        validateResponse: param.validateResponse,
        unauthenticated: param.unauthenticated,
        accessKey: param.accessKey,
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
        e.message = `${message} (original: ${e.message})`;
        throw e;
      });
    }

    function getSenderCertificate() {
      return _ajax({
        call: 'deliveryCert',
        httpType: 'GET',
        responseType: 'json',
        schema: { certificate: 'string' },
      });
    }

    function registerSupportForUnauthenticatedDelivery() {
      return _ajax({
        call: 'supportUnauthenticatedDelivery',
        httpType: 'PUT',
        responseType: 'json',
      });
    }

    function getProfile(number) {
      return _ajax({
        call: 'profile',
        httpType: 'GET',
        urlParameters: `/${number}`,
        responseType: 'json',
      });
    }
    function getProfileUnauth(number, { accessKey } = {}) {
      return _ajax({
        call: 'profile',
        httpType: 'GET',
        urlParameters: `/${number}`,
        responseType: 'json',
        unauthenticated: true,
        accessKey,
      });
    }

    function getAvatar(path) {
      // Using _outerAJAX, since it's not hardcoded to the Signal Server. Unlike our
      //   attachment CDN, it uses our self-signed certificate, so we pass it in.
      return _outerAjax(`${cdnUrl}/${path}`, {
        certificateAuthority,
        contentType: 'application/octet-stream',
        proxyUrl,
        responseType: 'arraybuffer',
        timeout: 0,
        type: 'GET',
      });
    }

    function requestVerificationSMS(number) {
      return _ajax({
        call: 'accounts',
        httpType: 'GET',
        urlParameters: `/sms/code/${number}`,
      });
    }

    function requestVerificationVoice(number) {
      return _ajax({
        call: 'accounts',
        httpType: 'GET',
        urlParameters: `/voice/code/${number}`,
      });
    }

    async function confirmCode(
      number,
      code,
      newPassword,
      registrationId,
      deviceName,
      options = {}
    ) {
      const { accessKey } = options;
      const jsonData = {
        supportsSms: false,
        fetchesMessages: true,
        registrationId,
        unidentifiedAccessKey: accessKey
          ? _btoa(_getString(accessKey))
          : undefined,
        unrestrictedUnidentifiedAccess: false,
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

      // We update our saved username and password, since we're creating a new account
      username = number;
      password = newPassword;

      const response = await _ajax({
        call,
        httpType: 'PUT',
        urlParameters: urlPrefix + code,
        jsonData,
        responseType,
        validateResponse: schema,
      });

      // From here on out, our username will be our phone number combined with device
      username = `${number}.${response.deviceId || 1}`;

      return response;
    }

    function updateDeviceName(deviceName) {
      return _ajax({
        call: 'updateDeviceName',
        httpType: 'PUT',
        jsonData: {
          deviceName,
        },
      });
    }

    function removeSignalingKey() {
      return _ajax({
        call: 'removeSignalingKey',
        httpType: 'DELETE',
      });
    }

    function getDevices() {
      return _ajax({
        call: 'devices',
        httpType: 'GET',
      });
    }

    function registerKeys(genKeys) {
      const keys = {};
      keys.identityKey = _btoa(_getString(genKeys.identityKey));
      keys.signedPreKey = {
        keyId: genKeys.signedPreKey.keyId,
        publicKey: _btoa(_getString(genKeys.signedPreKey.publicKey)),
        signature: _btoa(_getString(genKeys.signedPreKey.signature)),
      };

      keys.preKeys = [];
      let j = 0;
      // eslint-disable-next-line guard-for-in, no-restricted-syntax
      for (const i in genKeys.preKeys) {
        keys.preKeys[j] = {
          keyId: genKeys.preKeys[i].keyId,
          publicKey: _btoa(_getString(genKeys.preKeys[i].publicKey)),
        };
        j += 1;
      }

      // This is just to make the server happy
      // (v2 clients should choke on publicKey)
      keys.lastResortKey = { keyId: 0x7fffffff, publicKey: _btoa('42') };

      return _ajax({
        call: 'keys',
        httpType: 'PUT',
        jsonData: keys,
      });
    }

    function setSignedPreKey(signedPreKey) {
      return _ajax({
        call: 'signed',
        httpType: 'PUT',
        jsonData: {
          keyId: signedPreKey.keyId,
          publicKey: _btoa(_getString(signedPreKey.publicKey)),
          signature: _btoa(_getString(signedPreKey.signature)),
        },
      });
    }

    function getMyKeys() {
      return _ajax({
        call: 'keys',
        httpType: 'GET',
        responseType: 'json',
        validateResponse: { count: 'number' },
      }).then(res => res.count);
    }

    function handleKeys(res) {
      if (!Array.isArray(res.devices)) {
        throw new Error('Invalid response');
      }
      res.identityKey = _base64ToBytes(res.identityKey);
      res.devices.forEach(device => {
        if (
          !_validateResponse(device, { signedPreKey: 'object' }) ||
          !_validateResponse(device.signedPreKey, {
            publicKey: 'string',
            signature: 'string',
          })
        ) {
          throw new Error('Invalid signedPreKey');
        }
        if (device.preKey) {
          if (
            !_validateResponse(device, { preKey: 'object' }) ||
            !_validateResponse(device.preKey, { publicKey: 'string' })
          ) {
            throw new Error('Invalid preKey');
          }
          // eslint-disable-next-line no-param-reassign
          device.preKey.publicKey = _base64ToBytes(device.preKey.publicKey);
        }
        // eslint-disable-next-line no-param-reassign
        device.signedPreKey.publicKey = _base64ToBytes(
          device.signedPreKey.publicKey
        );
        // eslint-disable-next-line no-param-reassign
        device.signedPreKey.signature = _base64ToBytes(
          device.signedPreKey.signature
        );
      });
      return res;
    }

    function getKeysForNumber(number, deviceId = '*') {
      return _ajax({
        call: 'keys',
        httpType: 'GET',
        urlParameters: `/${number}/${deviceId}`,
        responseType: 'json',
        validateResponse: { identityKey: 'string', devices: 'object' },
      }).then(handleKeys);
    }

    function getKeysForNumberUnauth(
      number,
      deviceId = '*',
      { accessKey } = {}
    ) {
      return _ajax({
        call: 'keys',
        httpType: 'GET',
        urlParameters: `/${number}/${deviceId}`,
        responseType: 'json',
        validateResponse: { identityKey: 'string', devices: 'object' },
        unauthenticated: true,
        accessKey,
      }).then(handleKeys);
    }

    function sendMessagesUnauth(
      destination,
      messageArray,
      timestamp,
      silent,
      online,
      { accessKey } = {}
    ) {
      const jsonData = { messages: messageArray, timestamp };

      if (silent) {
        jsonData.silent = true;
      }
      if (online) {
        jsonData.online = true;
      }

      return _ajax({
        call: 'messages',
        httpType: 'PUT',
        urlParameters: `/${destination}`,
        jsonData,
        responseType: 'json',
        unauthenticated: true,
        accessKey,
      });
    }

    function sendMessages(
      destination,
      messageArray,
      timestamp,
      silent,
      online
    ) {
      const jsonData = { messages: messageArray, timestamp };

      if (silent) {
        jsonData.silent = true;
      }
      if (online) {
        jsonData.online = true;
      }

      return _ajax({
        call: 'messages',
        httpType: 'PUT',
        urlParameters: `/${destination}`,
        jsonData,
        responseType: 'json',
      });
    }

    function getAttachment(fileUrl) {
      return _outerAjax(fileUrl, {
        contentType: 'application/octet-stream',
        proxyUrl,
        responseType: 'arraybuffer',
        timeout: 0,
        type: 'GET',
      });
    }

    function putAttachment(maybeEncryptedBin) {
      const formData = new FormData();
      const buffer = Buffer.from(maybeEncryptedBin);
      formData.append('type', 'network.loki');
      formData.append('content', buffer, {
        contentType: 'application/octet-stream',
        name: 'content',
        filename: 'attachment',
      });

      return lokiFileServerAPI.constructor.uploadPrivateAttachment(formData);
    }

    function putAvatar(bin) {
      const formData = new FormData();
      const buffer = Buffer.from(bin);
      formData.append('avatar', buffer, {
        contentType: 'application/octet-stream',
        name: 'avatar',
        filename: 'attachment',
      });
      return lokiFileServerAPI.uploadAvatar(formData);
    }

    // eslint-disable-next-line no-shadow
    async function getProxiedSize(url) {
      const result = await _outerAjax(url, {
        processData: false,
        responseType: 'arraybufferwithdetails',
        proxyUrl: contentProxyUrl,
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
        proxyUrl: contentProxyUrl,
        type: 'GET',
        redirect: 'follow',
        disableLogs: true,
        headers,
      });
    }

    function getMessageSocket() {
      log.info('opening message socket', url);
      const fixedScheme = url
        .replace('https://', 'wss://')
        .replace('http://', 'ws://');
      const login = encodeURIComponent(username);
      const pass = encodeURIComponent(password);

      return _createSocket(
        `${fixedScheme}/v1/websocket/?login=${login}&password=${pass}&agent=OWD`,
        { certificateAuthority, proxyUrl }
      );
    }

    function getProvisioningSocket() {
      log.info('opening provisioning socket', url);
      const fixedScheme = url
        .replace('https://', 'wss://')
        .replace('http://', 'ws://');

      return _createSocket(
        `${fixedScheme}/v1/websocket/provisioning/?agent=OWD`,
        { certificateAuthority, proxyUrl }
      );
    }
  }
}
