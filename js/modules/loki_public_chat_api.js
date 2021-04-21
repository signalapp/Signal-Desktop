/* global log, process */
const EventEmitter = require('events');
const LokiAppDotNetAPI = require('./loki_app_dot_net_api');
const OpenGroupUtils = require('../../ts/opengroup/utils/OpenGroupUtils');

class LokiPublicChatFactoryAPI extends EventEmitter {
  constructor(ourKey) {
    super();
    this.ourKey = ourKey;
    this.servers = [];
    this.allMembers = [];
    this.openGroupPubKeys = {};
    // Multidevice states
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

      const serverIsValid = await OpenGroupUtils.validOpenGroupServer(
        serverUrl
      );
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
