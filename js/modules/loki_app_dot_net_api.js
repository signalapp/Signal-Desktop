/* global log, textsecure, libloki, Signal, Whisper, ConversationController,
clearTimeout, MessageController, libsignal, StringView, window, _,
dcodeIO, Buffer, lokiSnodeAPI, TextDecoder, process */
const nodeFetch = require('node-fetch');
const { URL, URLSearchParams } = require('url');
const FormData = require('form-data');
const https = require('https');

// Can't be less than 1200 if we have unauth'd requests
const PUBLICCHAT_MSG_POLL_EVERY = 1.5 * 1000; // 1.5s
const PUBLICCHAT_CHAN_POLL_EVERY = 20 * 1000; // 20s
const PUBLICCHAT_DELETION_POLL_EVERY = 5 * 1000; // 5s
const PUBLICCHAT_MOD_POLL_EVERY = 30 * 1000; // 30s
const PUBLICCHAT_MIN_TIME_BETWEEN_DUPLICATE_MESSAGES = 10 * 1000; // 10s

const HOMESERVER_USER_ANNOTATION_TYPE = 'network.loki.messenger.homeserver';
const AVATAR_USER_ANNOTATION_TYPE = 'network.loki.messenger.avatar';
const SETTINGS_CHANNEL_ANNOTATION_TYPE = 'net.patter-app.settings';
const MESSAGE_ATTACHMENT_TYPE = 'net.app.core.oembed';
const LOKI_ATTACHMENT_TYPE = 'attachment';
const LOKI_PREVIEW_TYPE = 'preview';

const snodeHttpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

// the core ADN class that handles all communication with a specific server
class LokiAppDotNetServerAPI {
  constructor(ourKey, url) {
    this.ourKey = ourKey;
    this.channels = [];
    this.tokenPromise = null;
    this.baseServerUrl = url;
    log.info(`LokiAppDotNetAPI registered server ${url}`);
  }

  async open() {
    // check token, we're not sure how long we were asleep, token may have expired
    await this.getOrRefreshServerToken();
    // now that we have a working token, start up pollers
    this.channels.forEach(channel => channel.open());
  }

  async close() {
    this.channels.forEach(channel => channel.stop());
    // match sure our pending requests are finished
    // in case it's still starting up
    if (this.tokenPromise) {
      await this.tokenPromise;
    }
  }

  // channel getter/factory
  async findOrCreateChannel(chatAPI, channelId, conversationId) {
    let thisChannel = this.channels.find(
      channel => channel.channelId === channelId
    );
    if (!thisChannel) {
      // make sure we're subscribed
      // eventually we'll need to move to account registration/add server
      await this.serverRequest(`channels/${channelId}/subscribe`, {
        method: 'POST',
      });
      thisChannel = new LokiPublicChannelAPI(
        chatAPI,
        this,
        channelId,
        conversationId
      );
      log.info(
        'LokiPublicChannelAPI started for',
        channelId,
        'on',
        this.baseServerUrl
      );
      this.channels.push(thisChannel);
    }
    return thisChannel;
  }

  async partChannel(channelId) {
    log.info('partChannel', channelId, 'from', this.baseServerUrl);
    await this.serverRequest(`channels/${channelId}/subscribe`, {
      method: 'DELETE',
    });
    this.unregisterChannel(channelId);
  }

  // deallocate resources channel uses
  unregisterChannel(channelId) {
    log.info('unregisterChannel', channelId, 'from', this.baseServerUrl);
    let thisChannel;
    let i = 0;
    for (; i < this.channels.length; i += 1) {
      if (this.channels[i].channelId === channelId) {
        thisChannel = this.channels[i];
        break;
      }
    }
    if (!thisChannel) {
      return;
    }
    thisChannel.stop();
    this.channels.splice(i, 1);
  }

  async setProfileName(profileName) {
    // when we add an annotation, may need this
    /*
    const privKey = await this.getPrivateKey();
    // we might need an annotation that sets the homeserver for media
    // better to include this with each attachment...
    const objToSign = {
      name: profileName,
      version: 1,
      annotations: [],
    };
    const sig = await libsignal.Curve.async.calculateSignature(
      privKey,
      JSON.stringify(objToSign)
    );
    */

    // You cannot use null to clear the profile name
    // the name key has to be set to know what value we want changed
    const pName = profileName || '';

    const res = await this.serverRequest('users/me', {
      method: 'PATCH',
      objBody: {
        name: pName,
      },
    });
    // no big deal if it fails...
    if (res.err || !res.response || !res.response.data) {
      if (res.err) {
        log.error(
          `setProfileName Error ${res.err} ${res.statusCode}`,
          this.baseServerUrl
        );
      }
      return [];
    }

    // expecting a user object
    return res.response.data.annotations || [];

    // if no profileName should we update the local from the server?
    // no because there will be multiple public chat servers
  }

  async setHomeServer(homeServer) {
    const res = await this.serverRequest('users/me', {
      method: 'PATCH',
      objBody: {
        annotations: [
          {
            type: HOMESERVER_USER_ANNOTATION_TYPE,
            value: homeServer,
          },
        ],
      },
    });

    if (res.err || !res.response || !res.response.data) {
      if (res.err) {
        log.error(`setHomeServer Error ${res.err}`);
      }
      return [];
    }

    // expecting a user object
    return res.response.data.annotations || [];
  }

  async setAvatar(url, profileKey) {
    let value; // undefined will save bandwidth on the annotation if we don't need it (no avatar)
    if (url && profileKey) {
      value = { url, profileKey };
    }
    return this.setSelfAnnotation(AVATAR_USER_ANNOTATION_TYPE, value);
  }

  // get active token for this server
  async getOrRefreshServerToken(forceRefresh = false) {
    let token;
    if (!forceRefresh) {
      if (this.token) {
        return this.token;
      }
      token = await Signal.Data.getPublicServerTokenByServerUrl(
        this.baseServerUrl
      );
    }
    if (!token) {
      token = await this.refreshServerToken();
      if (token) {
        await Signal.Data.savePublicServerToken({
          serverUrl: this.baseServerUrl,
          token,
        });
      }
    }
    this.token = token;

    // if no token to verify, just bail now
    if (!token) {
      // if we haven't forced it
      if (!forceRefresh) {
        // try one more time with requesting a fresh token
        token = await this.getOrRefreshServerToken(true);
      }
      return token;
    }

    // verify token info
    const tokenRes = await this.serverRequest('token');
    // if no problems and we have data
    if (
      !tokenRes.err &&
      tokenRes.response &&
      tokenRes.response.data &&
      tokenRes.response.data.user
    ) {
      // get our profile name
      // this should be primaryDevicePubKey
      // because the rest of the profile system uses that...
      const ourNumber =
        window.storage.get('primaryDevicePubKey') ||
        textsecure.storage.user.getNumber();
      const profileConvo = ConversationController.get(ourNumber);
      const profile = profileConvo && profileConvo.getLokiProfile();
      const profileName = profile && profile.displayName;
      // if doesn't match, write it to the network
      if (tokenRes.response.data.user.name !== profileName) {
        // update our profile name if it got out of sync
        this.setProfileName(profileName);
      }
    }
    if (tokenRes.err) {
      log.error(`token err`, tokenRes);
      // didn't already try && this specific error
      if (
        !forceRefresh &&
        tokenRes.response &&
        tokenRes.response.meta &&
        tokenRes.response.meta.code === 401
      ) {
        // this token is not good
        this.token = ''; // remove from object
        await Signal.Data.savePublicServerToken({
          serverUrl: this.baseServerUrl,
          token: '',
        });
        token = await this.getOrRefreshServerToken(true);
      }
    }

    return token;
  }

  // get active token from server (but only allow one request at a time)
  async refreshServerToken() {
    // if currently not in progress
    if (this.tokenPromise === null) {
      // FIXME: add timeout
      // a broken/stuck token endpoint can prevent you from removing channels
      // set lock
      this.tokenPromise = new Promise(async res => {
        // request the token
        const token = await this.requestToken();
        if (!token) {
          res(null);
          return;
        }
        // activate the token
        const registered = await this.submitToken(token);
        if (!registered) {
          res(null);
          return;
        }
        // resolve promise to release lock
        res(token);
      });
    }
    // wait until we have it set
    const token = await this.tokenPromise;
    // clear lock
    this.tokenPromise = null;
    return token;
  }

  // request an token from the server
  async requestToken() {
    let res;
    try {
      const url = new URL(`${this.baseServerUrl}/loki/v1/get_challenge`);
      const params = {
        pubKey: this.ourKey,
      };
      url.search = new URLSearchParams(params);

      res = await this.proxyFetch(url);
    } catch (e) {
      // should we retry here?
      // no, this is the low level function
      // not really an error, from a client's pov, network servers can fail...
      if (e.code === 'ECONNREFUSED') {
        // down
        log.warn(
          'requestToken request can not connect',
          this.baseServerUrl,
          e.message
        );
      } else if (e.code === 'ECONNRESET') {
        // got disconnected
        log.warn(
          'requestToken request lost connection',
          this.baseServerUrl,
          e.message
        );
      } else {
        log.error(
          'requestToken request failed',
          this.baseServerUrl,
          e.code,
          e.message
        );
      }
      return null;
    }
    if (!res.ok) {
      log.error('requestToken request failed');
      return null;
    }
    const body = await res.json();
    const token = await libloki.crypto.decryptToken(body);
    return token;
  }

  // activate token
  async submitToken(token) {
    const fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pubKey: this.ourKey,
        token,
      }),
    };

    try {
      const res = await this.proxyFetch(
        `${this.baseServerUrl}/loki/v1/submit_challenge`,
        fetchOptions,
        { textResponse: true }
      );
      return res.ok;
    } catch (e) {
      log.error('submitToken proxyFetch failure', e.code, e.message);
      return false;
    }
  }

  async proxyFetch(urlObj, fetchOptions = { method: 'GET' }, options = {}) {
    if (
      window.lokiFeatureFlags.useSnodeProxy &&
      (this.baseServerUrl === 'https://file-dev.lokinet.org' ||
        this.baseServerUrl === 'https://file.lokinet.org' ||
        this.baseServerUrl === 'https://file-dev.getsession.org' ||
        this.baseServerUrl === 'https://file.getsession.org')
    ) {
      const finalOptions = { ...fetchOptions };
      if (!fetchOptions.method) {
        finalOptions.method = 'GET';
      }
      const urlStr = urlObj.toString();
      const endpoint = urlStr.replace(`${this.baseServerUrl}/`, '');
      const { response, result } = await this._sendToProxy(
        endpoint,
        finalOptions,
        options
      );
      // emulate nodeFetch response...
      return {
        ok: result.status === 200,
        json: () => response,
      };
    }
    return nodeFetch(urlObj, fetchOptions, options);
  }

  async _sendToProxy(endpoint, pFetchOptions, options = {}) {
    const randSnode = await lokiSnodeAPI.getRandomSnodeAddress();
    const url = `https://${randSnode.ip}:${randSnode.port}/file_proxy`;

    const fetchOptions = pFetchOptions; // make lint happy
    // safety issue with file server, just safer to have this
    if (fetchOptions.headers === undefined) {
      fetchOptions.headers = {};
    }

    const payloadObj = {
      body: fetchOptions.body, // might need to b64 if binary...
      endpoint,
      method: fetchOptions.method,
      headers: fetchOptions.headers,
    };

    // from https://github.com/sindresorhus/is-stream/blob/master/index.js
    if (
      payloadObj.body &&
      typeof payloadObj.body === 'object' &&
      typeof payloadObj.body.pipe === 'function'
    ) {
      log.info('detected body is a stream');
      const fData = payloadObj.body.getBuffer();
      const fHeaders = payloadObj.body.getHeaders();
      // update headers for boundary
      payloadObj.headers = { ...payloadObj.headers, ...fHeaders };
      // update body with base64 chunk
      payloadObj.body = {
        fileUpload: fData.toString('base64'),
      };
    }

    // convert our payload to binary buffer
    const payloadData = Buffer.from(
      dcodeIO.ByteBuffer.wrap(JSON.stringify(payloadObj)).toArrayBuffer()
    );
    payloadObj.body = false; // free memory

    // make temporary key for this request/response
    const ephemeralKey = libsignal.Curve.generateKeyPair();

    // mix server pub key with our priv key
    const symKey = libsignal.Curve.calculateAgreement(
      this.pubKey, // server's pubkey
      ephemeralKey.privKey // our privkey
    );

    const ivAndCiphertext = await libloki.crypto.DHEncrypt(symKey, payloadData);

    // convert final buffer to base64
    const cipherText64 = dcodeIO.ByteBuffer.wrap(ivAndCiphertext).toString(
      'base64'
    );

    const ephemeralPubKey64 = dcodeIO.ByteBuffer.wrap(
      ephemeralKey.pubKey
    ).toString('base64');

    const finalRequestHeader = {
      'X-Loki-File-Server-Ephemeral-Key': ephemeralPubKey64,
    };

    const firstHopOptions = {
      method: 'POST',
      // not sure why I can't use anything but json...
      // text/plain would be preferred...
      body: JSON.stringify({ cipherText64 }),
      headers: {
        'Content-Type': 'application/json',
        'X-Loki-File-Server-Target': '/loki/v1/secure_rpc',
        'X-Loki-File-Server-Verb': 'POST',
        'X-Loki-File-Server-Headers': JSON.stringify(finalRequestHeader),
      },
      // we are talking to a snode...
      agent: snodeHttpsAgent,
    };
    // weird this doesn't need NODE_TLS_REJECT_UNAUTHORIZED = 0
    const result = await nodeFetch(url, firstHopOptions);

    const txtResponse = await result.text();
    if (txtResponse.match(/^Service node is not ready: not in any swarm/i)) {
      // mark snode bad
      log.warn(
        `Marking random snode bad, internet address ${randSnode.ip}:${
          randSnode.port
        }`
      );
      lokiSnodeAPI.markRandomNodeUnreachable(randSnode);
      // retry (hopefully with new snode)
      // FIXME: max number of retries...
      return this._sendToProxy(endpoint, fetchOptions);
    }

    let response = {};
    try {
      response = JSON.parse(txtResponse);
    } catch (e) {
      log.warn(
        `_sendToProxy Could not parse outer JSON [${txtResponse}]`,
        endpoint
      );
    }

    if (response.meta && response.meta.code === 200) {
      // convert base64 in response to binary
      const ivAndCiphertextResponse = dcodeIO.ByteBuffer.wrap(
        response.data,
        'base64'
      ).toArrayBuffer();
      const decrypted = await libloki.crypto.DHDecrypt(
        symKey,
        ivAndCiphertextResponse
      );
      const textDecoder = new TextDecoder();
      const respStr = textDecoder.decode(decrypted);
      // replace response
      try {
        response = options.textResponse ? respStr : JSON.parse(respStr);
      } catch (e) {
        log.warn(
          `_sendToProxy Could not parse inner JSON [${respStr}]`,
          endpoint
        );
      }
    } else {
      log.warn(
        'file server secure_rpc gave an non-200 response: ',
        response,
        ` txtResponse[${txtResponse}]`,
        endpoint
      );
    }
    return { result, txtResponse, response };
  }

  // make a request to the server
  async serverRequest(endpoint, options = {}) {
    const {
      params = {},
      method,
      rawBody,
      objBody,
      forceFreshToken = false,
    } = options;

    const url = new URL(`${this.baseServerUrl}/${endpoint}`);
    if (params) {
      url.search = new URLSearchParams(params);
    }
    const fetchOptions = {};
    const headers = {};
    try {
      if (forceFreshToken) {
        await this.getOrRefreshServerToken(true);
      }
      if (this.token) {
        headers.Authorization = `Bearer ${this.token}`;
      }
      if (method) {
        fetchOptions.method = method;
      }
      if (objBody) {
        headers['Content-Type'] = 'application/json';
        fetchOptions.body = JSON.stringify(objBody);
      } else if (rawBody) {
        fetchOptions.body = rawBody;
      }
      fetchOptions.headers = headers;

      // domain ends in .loki
      if (endpoint.match(/\.loki\//)) {
        fetchOptions.agent = snodeHttpsAgent;
      }
    } catch (e) {
      log.info('serverRequest set up error:', e.code, e.message);
      return {
        err: e,
      };
    }

    let response;
    let result;
    let txtResponse;
    let mode = 'nodeFetch';
    try {
      if (
        window.lokiFeatureFlags.useSnodeProxy &&
        (this.baseServerUrl === 'https://file-dev.lokinet.org' ||
          this.baseServerUrl === 'https://file.lokinet.org' ||
          this.baseServerUrl === 'https://file-dev.getsession.org' ||
          this.baseServerUrl === 'https://file.getsession.org')
      ) {
        mode = '_sendToProxy';

        const endpointWithQS = url
          .toString()
          .replace(`${this.baseServerUrl}/`, '');
        ({ response, txtResponse, result } = await this._sendToProxy(
          endpointWithQS,
          fetchOptions,
          options
        ));
      } else {
        // disable check for .loki
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = endpoint.match(/\.loki\//)
          ? 0
          : 1;
        result = await nodeFetch(url, fetchOptions);
        // always make sure this check is enabled
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = 1;
        txtResponse = await result.text();
        // hrm cloudflare timeouts (504s) will be html...
        response = options.textResponse ? txtResponse : JSON.parse(txtResponse);
      }
    } catch (e) {
      if (txtResponse) {
        log.info(
          `serverRequest ${mode} error`,
          e.code,
          e.message,
          `json: ${txtResponse}`,
          'attempting connection to',
          url
        );
      } else {
        log.info(
          `serverRequest ${mode} error`,
          e.code,
          e.message,
          'attempting connection to',
          url
        );
      }
      return {
        err: e,
      };
    }
    // if it's a response style with a meta
    if (result.status !== 200) {
      if (!forceFreshToken && (!response.meta || response.meta.code === 401)) {
        // copy options because lint complains if we modify this directly
        const updatedOptions = options;
        // force it this time
        updatedOptions.forceFreshToken = true;
        // retry with updated options
        return this.serverRequest(endpoint, updatedOptions);
      }
      return {
        err: 'statusCode',
        statusCode: result.status,
        response,
      };
    }
    return {
      statusCode: result.status,
      response,
    };
  }

  async getUserAnnotations(pubKey) {
    if (!pubKey) {
      log.warn('No pubkey provided to getUserAnnotations!');
      return [];
    }
    const res = await this.serverRequest(`users/@${pubKey}`, {
      method: 'GET',
      params: {
        include_user_annotations: 1,
      },
    });

    if (res.err || !res.response || !res.response.data) {
      if (res.err) {
        log.error(`getUserAnnotations Error ${res.err}`);
      }
      return [];
    }

    return res.response.data.annotations || [];
  }

  async getModerators(channelId) {
    if (!channelId) {
      log.warn('No channelId provided to getModerators!');
      return [];
    }
    const res = await this.serverRequest(
      `loki/v1/channels/${channelId}/moderators`
    );

    return (!res.err && res.response && res.response.moderators) || [];
  }

  async addModerators(pubKeysParam) {
    let pubKeys = pubKeysParam;
    if (!Array.isArray(pubKeys)) {
      pubKeys = [pubKeys];
    }
    pubKeys = pubKeys.map(key => `@${key}`);
    const users = await this.getUsers(pubKeys);
    const validUsers = users.filter(user => !!user.id);
    const results = await Promise.all(
      validUsers.map(async user => {
        log.info(`POSTing loki/v1/moderators/${user.id}`);
        const res = await this.serverRequest(`loki/v1/moderators/${user.id}`, {
          method: 'POST',
        });
        return !!(!res.err && res.response && res.response.data);
      })
    );
    const anyFailures = results.some(test => !test);
    return anyFailures ? results : true; // return failures or total success
  }

  async removeModerators(pubKeysParam) {
    let pubKeys = pubKeysParam;
    if (!Array.isArray(pubKeys)) {
      pubKeys = [pubKeys];
    }
    pubKeys = pubKeys.map(key => `@${key}`);
    const users = await this.getUsers(pubKeys);
    const validUsers = users.filter(user => !!user.id);

    const results = await Promise.all(
      validUsers.map(async user => {
        const res = await this.serverRequest(`loki/v1/moderators/${user.id}`, {
          method: 'DELETE',
        });
        return !!(!res.err && res.response && res.response.data);
      })
    );
    const anyFailures = results.some(test => !test);
    return anyFailures ? results : true; // return failures or total success
  }

  async getSubscribers(channelId, wantObjects) {
    if (!channelId) {
      log.warn('No channelId provided to getSubscribers!');
      return [];
    }

    let res = {};
    if (!Array.isArray(channelId) && wantObjects) {
      res = await this.serverRequest(`channels/${channelId}/subscribers`, {
        method: 'GET',
        params: {
          include_user_annotations: 1,
        },
      });
    } else {
      // not deployed on all backends yet
      res.err = 'array subscribers endpoint not yet implemented';
      /*
      var list = channelId;
      if (!Array.isArray(list)) {
        list = [channelId];
      }
      const idres = await this.serverRequest(`channels/subscribers/ids`, {
        method: 'GET',
        params: {
          ids: list.join(','),
          include_user_annotations: 1,
        },
      });
      if (wantObjects) {
        if (idres.err || !idres.response || !idres.response.data) {
          if (idres.err) {
            log.error(`Error ${idres.err}`);
          }
          return [];
        }
        const userList = [];
        await Promise.all(idres.response.data.map(async channelId => {
          const channelUserObjs = await this.getUsers(idres.response.data[channelId]);
          userList.push(...channelUserObjs);
        }));
        res = {
          response: {
            meta: {
              code: 200,
            },
            data: userList
          }
        }
      } else {
        res = idres;
      }
      */
    }

    if (res.err || !res.response || !res.response.data) {
      if (res.err) {
        log.error(`getSubscribers Error ${res.err}`);
      }
      return [];
    }

    return res.response.data || [];
  }

  async getUsers(pubKeys) {
    if (!pubKeys) {
      log.warn('No pubKeys provided to getUsers!');
      return [];
    }
    // ok to call without
    if (!pubKeys.length) {
      return [];
    }
    if (pubKeys.length > 200) {
      log.warn('Too many pubKeys given to getUsers!');
    }
    const res = await this.serverRequest('users', {
      method: 'GET',
      params: {
        ids: pubKeys.join(','),
        include_user_annotations: 1,
      },
    });

    if (res.err || !res.response || !res.response.data) {
      if (res.err) {
        log.error(`getUsers Error ${res.err}`);
      }
      return [];
    }

    return res.response.data || [];
  }

  // Only one annotation at a time
  async setSelfAnnotation(type, value) {
    const annotation = { type };

    // to delete annotation, omit the "value" field
    if (value) {
      annotation.value = value;
    }

    const res = await this.serverRequest('users/me', {
      method: 'PATCH',
      objBody: {
        annotations: [annotation],
      },
    });

    if (!res.err && res.response) {
      return res.response;
    }

    return false;
  }

  async uploadAvatar(data) {
    const endpoint = 'users/me/avatar';

    const options = {
      method: 'POST',
      rawBody: data,
    };

    const { statusCode, response } = await this.serverRequest(
      endpoint,
      options
    );

    if (statusCode !== 200) {
      log.warn('Failed to upload avatar to fileserver');
      return null;
    }

    const url =
      response.data &&
      response.data.avatar_image &&
      response.data.avatar_image.url;

    // We don't use the server id for avatars
    return {
      url,
      id: null,
    };
  }

  async uploadData(data) {
    const endpoint = 'files';
    const options = {
      method: 'POST',
      rawBody: data,
    };

    const { statusCode, response } = await this.serverRequest(
      endpoint,
      options
    );
    if (statusCode !== 200) {
      log.warn('Failed to upload data to server', this.baseServerUrl);
      return null;
    }

    const url = response.data && response.data.url;
    const id = response.data && response.data.id;
    return {
      url,
      id,
    };
  }

  putAttachment(attachmentBin) {
    const formData = new FormData();
    const buffer = Buffer.from(attachmentBin);
    formData.append('type', 'network.loki');
    formData.append('content', buffer, {
      contentType: 'application/octet-stream',
      name: 'content',
      filename: 'attachment',
      knownLength: buffer.byteLength,
    });

    return this.uploadData(formData);
  }
}

// functions to a specific ADN channel on an ADN server
class LokiPublicChannelAPI {
  constructor(chatAPI, serverAPI, channelId, conversationId) {
    // properties
    this.chatAPI = chatAPI;
    this.serverAPI = serverAPI;
    this.channelId = channelId;
    this.baseChannelUrl = `channels/${this.channelId}`;
    this.conversationId = conversationId;
    this.conversation = ConversationController.get(conversationId);
    this.lastGot = null;
    this.modStatus = false;
    this.deleteLastId = 1;
    this.timers = {};
    this.myPrivateKey = false;
    // can escalated to SQL if it start uses too much memory
    this.logMop = {};

    // Cache for duplicate checking
    this.lastMessagesCache = [];

    // end properties

    log.info(
      `registered LokiPublicChannel ${channelId} on ${
        this.serverAPI.baseServerUrl
      }`
    );
    // start polling
    this.open();
  }

  async getPrivateKey() {
    if (!this.myPrivateKey) {
      const myKeyPair = await textsecure.storage.protocol.getIdentityKeyPair();
      this.myPrivateKey = myKeyPair.privKey;
    }
    return this.myPrivateKey;
  }

  async banUser(pubkey) {
    const res = await this.serverRequest(
      `loki/v1/moderation/blacklist/@${pubkey}`,
      {
        method: 'POST',
      }
    );

    if (res.err || !res.response || !res.response.data) {
      if (res.err) {
        log.error(`banUser Error ${res.err}`);
      }
      return false;
    }

    return true;
  }

  open() {
    log.info(
      `LokiPublicChannel open ${this.channelId} on ${
        this.serverAPI.baseServerUrl
      }`
    );
    if (this.running) {
      log.warn(
        `LokiPublicChannel already open ${this.channelId} on ${
          this.serverAPI.baseServerUrl
        }`
      );
    }
    this.running = true;
    if (!this.timers.channel) {
      this.pollForChannel();
    }
    if (!this.timers.moderator) {
      this.pollForModerators();
    }
    if (!this.timers.delete) {
      this.pollForDeletions();
    }
    if (!this.timers.message) {
      this.pollForMessages();
    }
    // TODO: poll for group members here?
  }

  stop() {
    log.info(
      `LokiPublicChannel close ${this.channelId} on ${
        this.serverAPI.baseServerUrl
      }`
    );
    if (!this.running) {
      log.warn(
        `LokiPublicChannel already open ${this.channelId} on ${
          this.serverAPI.baseServerUrl
        }`
      );
    }
    this.running = false;
    if (this.timers.channel) {
      clearTimeout(this.timers.channel);
      this.timers.channel = false;
    }
    if (this.timers.moderator) {
      clearTimeout(this.timers.moderator);
      this.timers.moderator = false;
    }
    if (this.timers.delete) {
      clearTimeout(this.timers.delete);
      this.timers.delete = false;
    }
    if (this.timers.message) {
      clearTimeout(this.timers.message);
      this.timers.message = false;
    }
  }

  serverRequest(endpoint, options = {}) {
    return this.serverAPI.serverRequest(endpoint, options);
  }

  getSubscribers() {
    return this.serverAPI.getSubscribers(this.channelId, true);
  }

  getModerators() {
    return this.serverAPI.getModerators(this.channelId);
  }

  // get moderation actions
  async pollForModerators() {
    try {
      await this.pollOnceForModerators();
    } catch (e) {
      log.warn(
        'Error while polling for public chat moderators:',
        e.code,
        e.message
      );
    }
    if (this.running) {
      this.timers.moderator = setTimeout(() => {
        this.pollForModerators();
      }, PUBLICCHAT_MOD_POLL_EVERY);
    }
  }

  // get moderator status
  async pollOnceForModerators() {
    // get moderator status
    const res = await this.serverRequest(
      `loki/v1/channels/${this.channelId}/moderators`
    );
    const ourNumberDevice = textsecure.storage.user.getNumber();
    const ourNumberProfile = window.storage.get('primaryDevicePubKey');

    // Get the list of moderators if no errors occurred
    const moderators = !res.err && res.response && res.response.moderators;

    // if we encountered problems then we'll keep the old mod status
    if (moderators) {
      this.modStatus =
        (ourNumberProfile && moderators.includes(ourNumberProfile)) ||
        moderators.includes(ourNumberDevice);
    }

    await this.conversation.setModerators(moderators || []);
  }

  async setChannelSettings(settings) {
    if (!this.modStatus) {
      // need moderator access to set this
      log.warn('Need moderator access to setChannelName');
      return false;
    }
    // racy!
    const res = await this.serverRequest(this.baseChannelUrl, {
      params: { include_annotations: 1 },
    });
    if (res.err) {
      // state unknown
      log.warn(`public chat channel state unknown, skipping set: ${res.err}`);
      return false;
    }
    let notes =
      res.response && res.response.data && res.response.data.annotations;
    if (!notes) {
      // ok if nothing is set yet
      notes = [];
    }
    let settingNotes = notes.filter(
      note => note.type === SETTINGS_CHANNEL_ANNOTATION_TYPE
    );
    if (!settingNotes) {
      // default name, description, avatar
      settingNotes = [
        {
          type: SETTINGS_CHANNEL_ANNOTATION_TYPE,
          value: {
            name: 'Your Public Chat',
            description: 'Your public chat room',
            avatar: 'images/group_default.png',
          },
        },
      ];
    }
    // update settings
    settingNotes[0].value = Object.assign(settingNotes[0].value, settings);
    // commit settings
    const updateRes = await this.serverRequest(
      `loki/v1/${this.baseChannelUrl}`,
      { method: 'PUT', objBody: { annotations: settingNotes } }
    );
    if (updateRes.err || !updateRes.response || !updateRes.response.data) {
      if (updateRes.err) {
        log.error(`setChannelSettings Error ${updateRes.err}`);
      }
      return false;
    }
    return true;
  }

  // Do we need this? They definitely make it more clear...
  setChannelName(name) {
    return this.setChannelSettings({ name });
  }
  setChannelDescription(description) {
    return this.setChannelSettings({ description });
  }
  setChannelAvatar(avatar) {
    return this.setChannelSettings({ avatar });
  }

  // delete messages on the server
  async deleteMessages(serverIds, canThrow = false) {
    const res = await this.serverRequest(
      this.modStatus ? `loki/v1/moderation/messages` : `loki/v1/messages`,
      { method: 'DELETE', params: { ids: serverIds } }
    );
    if (!res.err) {
      const deletedIds = res.response.data
        .filter(d => d.is_deleted)
        .map(d => d.id);

      if (deletedIds.length > 0) {
        log.info(`deleted ${serverIds} on ${this.baseChannelUrl}`);
      }

      const failedIds = res.response.data
        .filter(d => !d.is_deleted)
        .map(d => d.id);

      if (failedIds.length > 0) {
        log.warn(`failed to delete ${failedIds} on ${this.baseChannelUrl}`);
      }

      // Note: if there is no entry for message, we assume it wasn't found
      // on the server, so it is not treated as explicitly failed
      const ignoredIds = _.difference(
        serverIds,
        _.union(failedIds, deletedIds)
      );

      if (ignoredIds.length > 0) {
        log.warn(`No response for ${ignoredIds} on ${this.baseChannelUrl}`);
      }

      return { deletedIds, ignoredIds };
    }
    if (canThrow) {
      throw new textsecure.PublicChatError(
        'Failed to delete public chat message'
      );
    }
    return { deletedIds: [], ignoredIds: [] };
  }

  // used for sending messages
  getEndpoint() {
    const endpoint = `${this.serverAPI.baseServerUrl}/${
      this.baseChannelUrl
    }/messages`;
    return endpoint;
  }

  // get moderation actions
  async pollForChannel() {
    try {
      await this.pollForChannelOnce();
    } catch (e) {
      log.warn(
        'Error while polling for public chat room details',
        e.code,
        e.message
      );
    }
    if (this.running) {
      this.timers.channel = setTimeout(() => {
        this.pollForChannel();
      }, PUBLICCHAT_CHAN_POLL_EVERY);
    }
  }

  // update room details
  async pollForChannelOnce() {
    const res = await this.serverRequest(`${this.baseChannelUrl}`, {
      params: {
        include_annotations: 1,
      },
    });

    if (res.err || !res.response || !res.response.data) {
      return;
    }

    const { data } = res.response;

    if (data.annotations && data.annotations.length) {
      // get our setting note
      const settingNotes = data.annotations.filter(
        note => note.type === SETTINGS_CHANNEL_ANNOTATION_TYPE
      );
      const note = settingNotes && settingNotes.length ? settingNotes[0] : {};
      // setting_note.value.description only needed for directory
      if (note.value && note.value.name) {
        this.conversation.setGroupName(note.value.name);
      }
      if (note.value && note.value.avatar) {
        this.conversation.setProfileAvatar(note.value.avatar);
      }
      // is it mutable?
      // who are the moderators?
      // else could set a default in case of server problems...
    }

    if (data.counts && Number.isInteger(data.counts.subscribers)) {
      this.conversation.setSubscriberCount(data.counts.subscribers);
    }
  }

  // get moderation actions
  async pollForDeletions() {
    try {
      await this.pollOnceForDeletions();
    } catch (e) {
      log.warn(
        'Error while polling for public chat deletions:',
        e.code,
        e.message
      );
    }
    if (this.running) {
      this.timers.delete = setTimeout(() => {
        this.pollForDeletions();
      }, PUBLICCHAT_DELETION_POLL_EVERY);
    }
  }

  async pollOnceForDeletions() {
    // grab the last 200 deletions
    const params = {
      count: 200,
    };

    // start loop
    let more = true;
    while (more) {
      // set params to from where we last checked
      params.since_id = this.deleteLastId;

      // grab the next 200 deletions from where we last checked
      // eslint-disable-next-line no-await-in-loop
      const res = await this.serverRequest(
        `loki/v1/channel/${this.channelId}/deletes`,
        { params }
      );

      // if any problems, abort out
      if (res.err || !res.response) {
        if (res.err) {
          log.error(`pollOnceForDeletions Error ${res.err}`);
        }
        break;
      }

      // Process results
      res.response.data.reverse().forEach(deleteEntry => {
        // Escalate it up to the subsystem that can check to see if this has
        // been processed
        Whisper.events.trigger('deleteLocalPublicMessage', {
          messageServerId: deleteEntry.message_id,
          conversationId: this.conversationId,
        });
      });

      // update where we last checked
      this.deleteLastId = res.response.meta.max_id;
      more = res.response.meta.more && res.response.data.length >= params.count;
    }
  }

  static getSigData(
    sigVer,
    noteValue,
    attachmentAnnotations,
    previewAnnotations,
    adnMessage
  ) {
    let sigString = '';
    sigString += adnMessage.text.trim();
    sigString += noteValue.timestamp;
    if (noteValue.quote) {
      sigString += noteValue.quote.id;
      sigString += noteValue.quote.author;
      sigString += noteValue.quote.text.trim();
      if (adnMessage.reply_to) {
        sigString += adnMessage.reply_to;
      }
    }
    sigString += [...attachmentAnnotations, ...previewAnnotations]
      .map(data => data.id || data.image.id)
      .sort()
      .join();
    sigString += sigVer;
    return dcodeIO.ByteBuffer.wrap(sigString, 'utf8').toArrayBuffer();
  }

  async getMessengerData(adnMessage) {
    if (
      !Array.isArray(adnMessage.annotations) ||
      adnMessage.annotations.length === 0
    ) {
      return false;
    }
    const noteValue = adnMessage.annotations[0].value;

    // signatures now required
    if (!noteValue.sig || typeof noteValue.sig !== 'string') {
      return false;
    }

    // timestamp is the only required field we've had since the first deployed version
    const { timestamp, quote } = noteValue;

    let profileKey = null;
    let avatar = null;
    const avatarNote = adnMessage.user.annotations.find(
      note => note.type === AVATAR_USER_ANNOTATION_TYPE
    );
    if (avatarNote) {
      ({ profileKey, url: avatar } = avatarNote.value);
    }

    if (quote) {
      // TODO: Enable quote attachments again using proper ADN style
      quote.attachments = [];
    }

    // try to verify signature
    const { sig, sigver } = noteValue;
    const annoCopy = [...adnMessage.annotations];
    const attachments = annoCopy
      .filter(anno => anno.value.lokiType === LOKI_ATTACHMENT_TYPE)
      .map(attachment => ({ isRaw: true, ...attachment.value }));
    const preview = annoCopy
      .filter(anno => anno.value.lokiType === LOKI_PREVIEW_TYPE)
      .map(LokiPublicChannelAPI.getPreviewFromAnnotation);
    // strip out sig and sigver
    annoCopy[0] = _.omit(annoCopy[0], ['value.sig', 'value.sigver']);
    const sigData = LokiPublicChannelAPI.getSigData(
      sigver,
      noteValue,
      attachments,
      preview,
      adnMessage
    );

    const pubKeyBin = StringView.hexToArrayBuffer(adnMessage.user.username);
    const sigBin = StringView.hexToArrayBuffer(sig);
    try {
      await libsignal.Curve.async.verifySignature(pubKeyBin, sigData, sigBin);
    } catch (e) {
      if (e.message === 'Invalid signature') {
        // keep noise out of the logs, once per start up is enough
        if (this.logMop[adnMessage.id] === undefined) {
          log.warn(
            'Invalid or missing signature on ',
            this.serverAPI.baseServerUrl,
            this.channelId,
            adnMessage.id,
            'says',
            adnMessage.text,
            'from',
            adnMessage.user.username,
            'signature',
            sig,
            'signature version',
            sigver
          );
          this.logMop[adnMessage.id] = true;
        }
        // we now only accept valid messages into the public chat
        return false;
      }
      // any error should cause problem
      log.error(`Unhandled message signature validation error ${e.message}`);
      return false;
    }

    return {
      timestamp,
      attachments,
      preview,
      quote,
      avatar,
      profileKey,
    };
  }

  // get channel messages
  async pollForMessages() {
    try {
      await this.pollOnceForMessages();
    } catch (e) {
      log.warn(
        'Error while polling for public chat messages:',
        e.code,
        e.message
      );
    }
    if (this.running) {
      this.timers.message = setTimeout(() => {
        this.pollForMessages();
      }, PUBLICCHAT_MSG_POLL_EVERY);
    }
  }

  async pollOnceForMessages() {
    const params = {
      include_annotations: 1,
      include_user_annotations: 1, // to get the home server
      include_deleted: false,
    };
    if (!this.conversation) {
      log.warn('Trying to poll for non-existing public conversation');
      this.lastGot = 0;
    } else if (!this.lastGot) {
      this.lastGot = this.conversation.getLastRetrievedMessage();
    }
    params.since_id = this.lastGot;
    // Just grab the most recent 100 messages if you don't have a valid lastGot
    params.count = this.lastGot === 0 ? -100 : 20;
    // log.info(`Getting ${params.count} from ${this.lastGot} on ${this.baseChannelUrl}`);
    const res = await this.serverRequest(`${this.baseChannelUrl}/messages`, {
      params,
    });

    if (res.err || !res.response) {
      return;
    }

    let receivedAt = new Date().getTime();
    const homeServerPubKeys = {};
    let pendingMessages = [];

    // get our profile name
    const ourNumberDevice = textsecure.storage.user.getNumber();
    // if no primaryDevicePubKey fall back to ourNumberDevice
    const ourNumberProfile =
      window.storage.get('primaryDevicePubKey') || ourNumberDevice;
    let lastProfileName = false;

    // the signature forces this to be async
    pendingMessages = await Promise.all(
      // process these in chronological order
      res.response.data.reverse().map(async adnMessage => {
        // still update our last received if deleted, not signed or not valid
        this.lastGot = !this.lastGot
          ? adnMessage.id
          : Math.max(this.lastGot, adnMessage.id);

        if (
          !adnMessage.id ||
          !adnMessage.user ||
          !adnMessage.user.username || // pubKey lives in the username field
          !adnMessage.text ||
          adnMessage.is_deleted
        ) {
          return false; // Invalid or delete message
        }

        const pubKey = adnMessage.user.username;

        const messengerData = await this.getMessengerData(adnMessage);
        if (messengerData === false) {
          return false;
        }

        const {
          timestamp,
          quote,
          attachments,
          preview,
          avatar,
          profileKey,
        } = messengerData;
        if (!timestamp) {
          return false; // Invalid message
        }

        // Duplicate check
        const isDuplicate = message => {
          // The username in this case is the users pubKey
          const sameUsername = message.username === pubKey;
          const sameText = message.text === adnMessage.text;
          // Don't filter out messages that are too far apart from each other
          const timestampsSimilar =
            Math.abs(message.timestamp - timestamp) <=
            PUBLICCHAT_MIN_TIME_BETWEEN_DUPLICATE_MESSAGES;

          return sameUsername && sameText && timestampsSimilar;
        };

        // Filter out any messages that we got previously
        if (this.lastMessagesCache.some(isDuplicate)) {
          return false; // Duplicate message
        }

        // FIXME: maybe move after the de-multidev-decode
        // Add the message to the lastMessage cache and keep the last 5 recent messages
        this.lastMessagesCache = [
          ...this.lastMessagesCache,
          {
            username: pubKey,
            text: adnMessage.text,
            timestamp,
          },
        ].splice(-5);

        const from = adnMessage.user.name || 'Anonymous'; // profileName

        // if us
        if (pubKey === ourNumberProfile || pubKey === ourNumberDevice) {
          // update the last name we saw from ourself
          lastProfileName = from;
        }

        // track sources for multidevice support
        // sort it by home server
        let homeServer = window.getDefaultFileServer();
        if (adnMessage.user && adnMessage.user.annotations.length) {
          const homeNotes = adnMessage.user.annotations.filter(
            note => note.type === HOMESERVER_USER_ANNOTATION_TYPE
          );
          // FIXME: this annotation should probably be signed and verified...
          homeServer = homeNotes.reduce(
            (curVal, note) => (note.value ? note.value : curVal),
            homeServer
          );
        }
        if (homeServerPubKeys[homeServer] === undefined) {
          homeServerPubKeys[homeServer] = [];
        }
        if (homeServerPubKeys[homeServer].indexOf(`@${pubKey}`) === -1) {
          homeServerPubKeys[homeServer].push(`@${pubKey}`);
        }

        // generate signal message object
        const messageData = {
          serverId: adnMessage.id,
          clientVerified: true,
          friendRequest: false,
          source: pubKey,
          sourceDevice: 1,
          timestamp,

          serverTimestamp: timestamp,
          receivedAt,
          isPublic: true,
          message: {
            body:
              adnMessage.text === timestamp.toString() ? '' : adnMessage.text,
            attachments,
            group: {
              id: this.conversationId,
              type: textsecure.protobuf.GroupContext.Type.DELIVER,
            },
            flags: 0,
            expireTimer: 0,
            profileKey,
            timestamp,
            received_at: receivedAt,
            sent_at: timestamp,
            quote,
            contact: [],
            preview,
            profile: {
              displayName: from,
              avatar,
            },
          },
        };
        receivedAt += 1; // Ensure different arrival times

        // now process any user meta data updates
        // - update their conversation with a potentially new avatar
        return messageData;
      })
    );

    // do we really need this?
    if (!pendingMessages.length) {
      this.conversation.setLastRetrievedMessage(this.lastGot);
      return;
    }

    // slave to primary map for this group of messages
    let slavePrimaryMap = {};

    // reduce list of servers into verified maps and keys
    const verifiedPrimaryPKs = await Object.keys(homeServerPubKeys).reduce(
      async (curVal, serverUrl) => {
        // get an API to this server
        const serverAPI = await window.lokiFileServerAPIFactory.establishConnection(
          serverUrl
        );

        // get list of verified primary PKs
        const result = await serverAPI.verifyPrimaryPubKeys(
          homeServerPubKeys[serverUrl]
        );

        // merged these device mappings into our slavePrimaryMap
        // should not be any collisions, since each pubKey can only have one home server
        slavePrimaryMap = { ...slavePrimaryMap, ...result.slaveMap };

        // copy verified pub keys into result
        return curVal.concat(result.verifiedPrimaryPKs);
      },
      []
    );

    // filter out invalid messages
    pendingMessages = pendingMessages.filter(messageData => !!messageData);
    // separate messages coming from primary and secondary devices
    const [primaryMessages, slaveMessages] = _.partition(
      pendingMessages,
      message => !(message.source in slavePrimaryMap)
    );
    // process primary devices' message directly
    primaryMessages.forEach(message =>
      this.chatAPI.emit('publicMessage', {
        message,
      })
    );

    pendingMessages = []; // allow memory to be freed

    // get actual chat server data (mainly the name rn) of primary device
    const verifiedDeviceResults = await this.serverAPI.getUsers(
      verifiedPrimaryPKs
    );

    // build map of userProfileName to primaryKeys
    /* eslint-disable no-param-reassign */
    this.primaryUserProfileName = verifiedDeviceResults.reduce(
      (mapOut, user) => {
        let avatar = null;
        let profileKey = null;
        const avatarNote = user.annotations.find(
          note => note.type === AVATAR_USER_ANNOTATION_TYPE
        );
        if (avatarNote) {
          ({ profileKey, url: avatar } = avatarNote.value);
        }
        mapOut[user.username] = {
          name: user.name,
          avatar,
          profileKey,
        };
        return mapOut;
      },
      {}
    );
    /* eslint-enable no-param-reassign */

    // process remaining messages
    /* eslint-disable no-param-reassign */
    slaveMessages.forEach(messageData => {
      const slaveKey = messageData.source;

      // prevent our own device sent messages from coming back in
      if (slaveKey === ourNumberDevice) {
        // we originally sent these
        return;
      }

      // look up primary device once
      const primaryPubKey = slavePrimaryMap[slaveKey];

      // send out remaining messages for this merged identity
      /* eslint-disable no-param-reassign */
      if (slavePrimaryMap[slaveKey]) {
        // rewrite source, profile
        messageData.source = primaryPubKey;
        const primaryProfile = this.primaryUserProfileName[primaryPubKey];
        if (primaryProfile) {
          const { name, avatar, profileKey } = primaryProfile;
          messageData.message.profile.displayName = name;
          messageData.message.profile.avatar = avatar;
          messageData.message.profileKey = profileKey;
        }
      }
      /* eslint-enable no-param-reassign */
      this.chatAPI.emit('publicMessage', {
        message: messageData,
      });
    });
    /* eslint-enable no-param-reassign */

    // if we received one of our own messages
    if (lastProfileName !== false) {
      // get current profileName
      const profileConvo = ConversationController.get(ourNumberProfile);
      const profileName = profileConvo.getProfileName();
      // check to see if it out of sync
      if (profileName !== lastProfileName) {
        // out of sync, update this server
        this.serverAPI.setProfileName(profileName);
      }
    }

    // finally update our position
    this.conversation.setLastRetrievedMessage(this.lastGot);
  }

  static getPreviewFromAnnotation(annotation) {
    const preview = {
      title: annotation.value.linkPreviewTitle,
      url: annotation.value.linkPreviewUrl,
      image: {
        isRaw: true,
        caption: annotation.value.caption,
        contentType: annotation.value.contentType,
        digest: annotation.value.digest,
        fileName: annotation.value.fileName,
        flags: annotation.value.flags,
        height: annotation.value.height,
        id: annotation.value.id,
        key: annotation.value.key,
        size: annotation.value.size,
        thumbnail: annotation.value.thumbnail,
        url: annotation.value.url,
        width: annotation.value.width,
      },
    };
    return preview;
  }

  static getAnnotationFromPreview(preview) {
    const annotation = {
      type: MESSAGE_ATTACHMENT_TYPE,
      value: {
        // Mandatory ADN fields
        version: '1.0',
        lokiType: LOKI_PREVIEW_TYPE,

        // Signal stuff we actually care about
        linkPreviewTitle: preview.title,
        linkPreviewUrl: preview.url,
        caption: preview.image.caption,
        contentType: preview.image.contentType,
        digest: preview.image.digest,
        fileName: preview.image.fileName,
        flags: preview.image.flags,
        height: preview.image.height,
        id: preview.image.id,
        key: preview.image.key,
        size: preview.image.size,
        thumbnail: preview.image.thumbnail,
        url: preview.image.url,
        width: preview.image.width,
      },
    };
    return annotation;
  }

  static getAnnotationFromAttachment(attachment) {
    let type;
    if (attachment.contentType.match(/^image/)) {
      type = 'photo';
    } else if (attachment.contentType.match(/^video/)) {
      type = 'video';
    } else if (attachment.contentType.match(/^audio/)) {
      type = 'audio';
    } else {
      type = 'other';
    }
    const annotation = {
      type: MESSAGE_ATTACHMENT_TYPE,
      value: {
        // Mandatory ADN fields
        version: '1.0',
        type,
        lokiType: LOKI_ATTACHMENT_TYPE,

        // Signal stuff we actually care about
        ...attachment,
      },
    };
    return annotation;
  }

  // create a message in the channel
  async sendMessage(data, messageTimeStamp) {
    const { quote, attachments, preview } = data;
    const text = data.body || messageTimeStamp.toString();
    const attachmentAnnotations = attachments.map(
      LokiPublicChannelAPI.getAnnotationFromAttachment
    );
    const previewAnnotations = preview.map(
      LokiPublicChannelAPI.getAnnotationFromPreview
    );

    const payload = {
      text,
      annotations: [
        {
          type: 'network.loki.messenger.publicChat',
          value: {
            timestamp: messageTimeStamp,
          },
        },
        ...attachmentAnnotations,
        ...previewAnnotations,
      ],
    };

    if (quote && quote.id) {
      payload.annotations[0].value.quote = quote;

      // copied from model/message.js copyFromQuotedMessage
      const collection = await Signal.Data.getMessagesBySentAt(quote.id, {
        MessageCollection: Whisper.MessageCollection,
      });
      const found = collection.find(item => {
        const messageAuthor = item.getContact();

        return messageAuthor && quote.author === messageAuthor.id;
      });

      if (found) {
        const queryMessage = MessageController.register(found.id, found);
        const replyTo = queryMessage.get('serverId');
        if (replyTo) {
          payload.reply_to = replyTo;
        }
      }
    }
    const privKey = await this.getPrivateKey();
    const sigVer = 1;
    const mockAdnMessage = { text };
    if (payload.reply_to) {
      mockAdnMessage.reply_to = payload.reply_to;
    }
    const sigData = LokiPublicChannelAPI.getSigData(
      sigVer,
      payload.annotations[0].value,
      attachmentAnnotations.map(anno => anno.value),
      previewAnnotations.map(anno => anno.value),
      mockAdnMessage
    );
    const sig = await libsignal.Curve.async.calculateSignature(
      privKey,
      sigData
    );
    payload.annotations[0].value.sig = StringView.arrayBufferToHex(sig);
    payload.annotations[0].value.sigver = sigVer;
    const res = await this.serverRequest(`${this.baseChannelUrl}/messages`, {
      method: 'POST',
      objBody: payload,
    });
    if (!res.err && res.response) {
      return res.response.data.id;
    }
    if (res.err) {
      log.error(`POST ${this.baseChannelUrl}/messages failed`);
      if (res.response && res.response.meta && res.response.meta.code === 401) {
        log.error(`Got invalid token for ${this.serverAPI.token}`);
      }
      log.error(res.err);
      log.error(res.response);
    } else {
      log.warn(res.response);
    }
    // there's no retry on desktop
    // this is supposed to be after retries
    return false;
  }
}

module.exports = LokiAppDotNetServerAPI;
