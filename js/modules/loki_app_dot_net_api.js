/* global log,  libloki, Signal, StringView, window,, process */

const OnionSend = require('../../ts/session/onions/onionSend');

const LOKIFOUNDATION_APNS_PUBKEY = 'BWQqZYWRl0LlotTcUSRJZPvNi8qyt1YSQH3li4EHQNBJ';

const urlPubkeyMap = {
  'https://dev.apns.getsession.org': LOKIFOUNDATION_APNS_PUBKEY,
  'https://live.apns.getsession.org': LOKIFOUNDATION_APNS_PUBKEY,
};

// the core ADN class that handles all communication with a specific server
class LokiAppDotNetServerAPI {
  constructor(ourKey, url) {
    this.ourKey = ourKey;
    this.tokenPromise = null;
    this.baseServerUrl = url;
    log.info(`LokiAppDotNetAPI registered server ${url}`);
  }

  async open() {
    // check token, we're not sure how long we were asleep, token may have expired
    await this.getOrRefreshServerToken();
    // now that we have a working token, start up pollers
  }

  async close() {
    // match sure our pending requests are finished
    // in case it's still starting up
    if (this.tokenPromise) {
      await this.tokenPromise;
    }
  }

  // set up pubKey & pubKeyHex properties
  // optionally called for mainly file server comms
  getPubKeyForUrl() {
    if (!window.lokiFeatureFlags.useOnionRequests) {
      // pubkeys don't matter
      return '';
    }

    // Hard coded
    let pubKeyAB;
    if (urlPubkeyMap && urlPubkeyMap[this.baseServerUrl]) {
      pubKeyAB = window.Signal.Crypto.base64ToArrayBuffer(urlPubkeyMap[this.baseServerUrl]);
    }

    // do we have their pubkey locally?
    // FIXME: this._server won't be set yet...
    // can't really do this for the file server because we'll need the key
    // before we can communicate with lsrpc
    if (window.lokiFeatureFlags.useFileOnionRequests) {
      if (
        window.lokiPublicChatAPI &&
        window.lokiPublicChatAPI.openGroupPubKeys &&
        window.lokiPublicChatAPI.openGroupPubKeys[this.baseServerUrl]
      ) {
        pubKeyAB = window.lokiPublicChatAPI.openGroupPubKeys[this.baseServerUrl];
      }
    }
    // else will fail validation later

    // now that key is loaded, lets verify
    if (pubKeyAB && pubKeyAB.byteLength && pubKeyAB.byteLength !== 33) {
      log.error('FILESERVER PUBKEY is invalid, length:', pubKeyAB.byteLength);
      process.exit(1);
    }
    this.pubKey = pubKeyAB;
    this.pubKeyHex = StringView.arrayBufferToHex(pubKeyAB);

    return pubKeyAB;
  }

  // get active token for this server
  async getOrRefreshServerToken(forceRefresh = false) {
    let token;
    if (!forceRefresh) {
      if (this.token) {
        return this.token;
      }
      token = await Signal.Data.getPublicServerTokenByServerUrl(this.baseServerUrl);
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
      const ourNumber = window.libsession.Utils.UserUtils.getOurPubKeyStrFromCache();
      const profileConvo = window.getConversationController().get(ourNumber);
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
      const params = {
        pubKey: this.ourKey,
      };
      res = await this.serverRequest('loki/v1/get_challenge', {
        method: 'GET',
        params,
      });
    } catch (e) {
      // should we retry here?
      // no, this is the low level function
      // not really an error, from a client's pov, network servers can fail...
      if (e.code === 'ECONNREFUSED') {
        // down
        log.warn('requestToken request can not connect', this.baseServerUrl, e.message);
      } else if (e.code === 'ECONNRESET') {
        // got disconnected
        log.warn('requestToken request lost connection', this.baseServerUrl, e.message);
      } else {
        log.error('requestToken request failed', this.baseServerUrl, e.code, e.message);
      }
      return null;
    }
    if (!res.ok) {
      log.error('requestToken request failed');
      return null;
    }
    const body = res.response;
    const token = await libloki.crypto.decryptToken(body);
    return token;
  }

  // activate token
  async submitToken(token) {
    try {
      const res = await this.serverRequest('loki/v1/submit_challenge', {
        method: 'POST',
        objBody: {
          pubKey: this.ourKey,
          token,
        },
        noJson: true,
      });
      return res.ok;
    } catch (e) {
      log.error('submitToken serverRequest failure', e.code, e.message);
      return false;
    }
  }

  // make a request to the server
  async serverRequest(endpoint, options = {}) {
    if (options.forceFreshToken) {
      await this.getOrRefreshServerToken(true);
    }
    return OnionSend.serverRequest(`${this.baseServerUrl}/${endpoint}`, {
      ...options,
      token: this.token,
      srvPubKey: this.pubKeyHex,
    });
  }
}

LokiAppDotNetServerAPI.serverRequest = OnionSend.serverRequest;

// These files are expected to be in commonjs so we can't use es6 syntax :(
// If we move these to TS then we should be able to use es6
module.exports = LokiAppDotNetServerAPI;
