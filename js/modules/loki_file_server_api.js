/* global log, window */
/* global log: false */

const LokiAppDotNetAPI = require('./loki_app_dot_net_api');

// can have multiple of these instances as each user can have a
// different home server
class LokiFileServerInstance {
  constructor(ourKey) {
    this.ourKey = ourKey;
  }

  // FIXME: this is not file-server specific
  // and is currently called by LokiAppDotNetAPI.
  // LokiAppDotNetAPI (base) should not know about LokiFileServer.
  async establishConnection(serverUrl, options) {
    // why don't we extend this?
    this._server = new LokiAppDotNetAPI(this.ourKey, serverUrl);

    // make sure pubKey & pubKeyHex are set in _server
    this.pubKey = this._server.getPubKeyForUrl();

    if (options !== undefined && options.skipToken) {
      return;
    }

    // get a token for multidevice
    const gotToken = await this._server.getOrRefreshServerToken();
    // TODO: Handle this failure gracefully
    if (!gotToken) {
      log.error('You are blacklisted form this home server');
    }
  }

  // for files
  async downloadAttachment(url) {
    return this._server.downloadAttachment(url);
  }
}

// extends LokiFileServerInstance with functions we'd only perform on our own home server
// so we don't accidentally send info to the wrong file server
class LokiHomeServerInstance extends LokiFileServerInstance {
  // you only upload to your own home server
  // you can download from any server...
  uploadAvatar(data) {
    if (!this._server.token) {
      log.warn('uploadAvatar no token yet');
    }
    return this._server.uploadAvatar(data);
  }

  static uploadPrivateAttachment(data) {
    return window.tokenlessFileServerAdnAPI.uploadData(data);
  }
}

// this will be our instance factory
class LokiFileServerFactoryAPI {
  constructor(ourKey) {
    this.ourKey = ourKey;
    this.servers = [];
  }

  establishHomeConnection(serverUrl) {
    let thisServer = this.servers.find(server => server._server.baseServerUrl === serverUrl);
    if (!thisServer) {
      thisServer = new LokiHomeServerInstance(this.ourKey);
      log.info(`Registering HomeServer ${serverUrl}`);
      // not await, so a failure or slow connection doesn't hinder loading of the app
      thisServer.establishConnection(serverUrl);
      this.servers.push(thisServer);
    }
    return thisServer;
  }

  async establishConnection(serverUrl) {
    let thisServer = this.servers.find(server => server._server.baseServerUrl === serverUrl);
    if (!thisServer) {
      thisServer = new LokiFileServerInstance(this.ourKey);
      log.info(`Registering FileServer ${serverUrl}`);
      await thisServer.establishConnection(serverUrl, { skipToken: true });
      this.servers.push(thisServer);
    }
    return thisServer;
  }
}

module.exports = LokiFileServerFactoryAPI;
