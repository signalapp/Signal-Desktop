/* global log, window, process, URL, dcodeIO */
const EventEmitter = require('events');
const LokiAppDotNetAPI = require('./loki_app_dot_net_api');

const nodeFetch = require('node-fetch');

const validOpenGroupServer = async serverUrl => {
  // test to make sure it's online (and maybe has a valid SSL cert)
  try {
    const url = new URL(serverUrl);

    if (window.lokiFeatureFlags.useFileOnionRequests) {
      // check for LSRPC

      // this is safe (as long as node's in your trust model)
      // because
      const result = await window.tokenlessFileServerAdnAPI.serverRequest(
        `loki/v1/getOpenGroupKey/${url.hostname}`
      );

      if (result.response.meta.code === 200) {
        // supports it
        const obj = JSON.parse(result.response.data);
        const pubKey = dcodeIO.ByteBuffer.wrap(
          obj.data,
          'base64'
        ).toArrayBuffer();
        // verify it works...
        // get around the FILESERVER_HOSTS filter by not using serverRequest
        const res = await LokiAppDotNetAPI.sendViaOnion(
          pubKey,
          url,
          { method: 'GET' },
          { noJson: true }
        );
        if (res.result && res.result.status === 200) {
          log.info(
            `loki_public_chat::validOpenGroupServer - onion routing enabled on ${url.toString()}`
          );
          // save pubkey for use...
          window.lokiPublicChatAPI.openGroupPubKeys[serverUrl] = pubKey;
          return true;
        }
        // otherwise fall back
      } else if (result.response.meta.code !== 404) {
        // unknown error code
        log.warn(
          'loki_public_chat::validOpenGroupServer - unknown error code',
          result.response.meta
        );
      }
    }
    // doesn't support it, fallback
    log.info(
      `loki_public_chat::validOpenGroupServer - directly contacting ${url.toString()}`
    );

    // allow .loki (may only need an agent but not sure
    //              until we have a .loki to test with)
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = url.host.match(/\.loki$/i)
      ? '0'
      : '1';
    await nodeFetch(serverUrl);
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';
    // const txt = await res.text();
  } catch (e) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';
    log.warn(
      `loki_public_chat::validOpenGroupServer - failing to create ${serverUrl}`,
      e.code,
      e.message
    );
    // bail out if not valid enough
    return false;
  }
  return true;
};

class LokiPublicChatFactoryAPI extends EventEmitter {
  constructor(ourKey) {
    super();
    this.ourKey = ourKey;
    this.servers = [];
    this.allMembers = [];
    this.openGroupPubKeys = {};
    // Multidevice states
    this.primaryUserProfileName = {};
  }

  // MessageReceiver.connect calls this
  // start polling in all existing registered channels
  async open() {
    await Promise.all(this.servers.map(server => server.open()));
  }

  // MessageReceiver.close
  async close() {
    await Promise.all(this.servers.map(server => server.close()));
  }

  // server getter/factory
  async findOrCreateServer(serverUrl) {
    let thisServer = this.servers.find(
      server => server.baseServerUrl === serverUrl
    );
    if (!thisServer) {
      log.info(`loki_public_chat::findOrCreateServer - creating ${serverUrl}`);

      const serverIsValid = await validOpenGroupServer(serverUrl);
      if (!serverIsValid) {
        // FIXME: add toast?
        log.error(
          `loki_public_chat::findOrCreateServer - error: ${serverUrl} is not valid`
        );
        return null;
      }

      // after verification then we can start up all the pollers
      if (process.env.USE_STUBBED_NETWORK) {
        // eslint-disable-next-line global-require
        const StubAppDotNetAPI = require('../.././ts/test/session/integration/stubs/stub_app_dot_net_api');
        thisServer = new StubAppDotNetAPI(this.ourKey, serverUrl);
      } else {
        thisServer = new LokiAppDotNetAPI(this.ourKey, serverUrl);
        if (this.openGroupPubKeys[serverUrl]) {
          thisServer.getPubKeyForUrl();
          if (!thisServer.pubKeyHex) {
            log.warn(
              `loki_public_chat::findOrCreateServer - failed to set public key`
            );
          }
        }
      }

      const gotToken = await thisServer.getOrRefreshServerToken();
      if (!gotToken) {
        log.warn(
          `loki_public_chat::findOrCreateServer - Invalid server ${serverUrl}`
        );
        return null;
      }
      if (window.isDev) {
        log.info(
          `loki_public_chat::findOrCreateServer - set token ${thisServer.token} for ${serverUrl}`
        );
      }

      this.servers.push(thisServer);
    }
    return thisServer;
  }

  // channel getter/factory
  async findOrCreateChannel(serverUrl, channelId, conversationId) {
    const server = await this.findOrCreateServer(serverUrl);
    if (!server) {
      log.error(`Failed to create server for: ${serverUrl}`);
      return null;
    }
    return server.findOrCreateChannel(this, channelId, conversationId);
  }

  // deallocate resources server uses
  unregisterChannel(serverUrl, channelId) {
    const i = this.servers.findIndex(
      server => server.baseServerUrl === serverUrl
    );
    if (i === -1) {
      log.warn(`Tried to unregister from nonexistent server ${serverUrl}`);
      return;
    }
    const thisServer = this.servers[i];
    if (!thisServer) {
      log.warn(`Tried to unregister from nonexistent server ${i}`);
      return;
    }
    thisServer.unregisterChannel(channelId);
    this.servers.splice(i, 1);
  }

  // shouldn't this be scoped per conversation?
  async getListOfMembers() {
    // enable in the next release
    /*
    let members = [];
    await Promise.all(this.servers.map(async server => {
      await Promise.all(server.channels.map(async channel => {
        const newMembers = await channel.getSubscribers();
        members = [...members, ...newMembers];
      }));
    }));
    const results = members.map(member => {
      return { authorPhoneNumber: member.username };
    });
    */
    return this.allMembers;
  }

  // TODO: make this private (or remove altogether) when
  // we switch to polling the server for group members
  setListOfMembers(members) {
    this.allMembers = members;
  }

  async setProfileName(profileName) {
    await Promise.all(
      this.servers.map(async server => {
        await server.setProfileName(profileName);
      })
    );
  }

  async setHomeServer(homeServer) {
    await Promise.all(
      this.servers.map(async server => {
        // this may fail
        // but we can't create a sql table to remember to retry forever
        // I think we just silently fail for now
        await server.setHomeServer(homeServer);
      })
    );
  }

  async setAvatar(url, profileKey) {
    await Promise.all(
      this.servers.map(async server => {
        // this may fail
        // but we can't create a sql table to remember to retry forever
        // I think we just silently fail for now
        await server.setAvatar(url, profileKey);
      })
    );
  }
}

// These files are expected to be in commonjs so we can't use es6 syntax :(
// If we move these to TS then we should be able to use es6
module.exports = LokiPublicChatFactoryAPI;
