/* global log */
const EventEmitter = require('events');
const LokiAppDotNetAPI = require('./loki_app_dot_net_api');

class LokiPublicChatFactoryAPI extends EventEmitter {
  constructor(ourKey) {
    super();
    this.ourKey = ourKey;
    this.servers = [];
    this.allMembers = [];
    // Multidevice states
    this.primaryUserProfileName = {};
  }

  async close() {
    await Promise.all(this.servers.map(server => server.close()));
  }

  // server getter/factory
  async findOrCreateServer(serverUrl) {
    let thisServer = this.servers.find(
      server => server.baseServerUrl === serverUrl
    );
    if (!thisServer) {
      log.info(`LokiAppDotNetAPI creating ${serverUrl}`);
      thisServer = new LokiAppDotNetAPI(this.ourKey, serverUrl);
      const gotToken = await thisServer.getOrRefreshServerToken();
      if (!gotToken) {
        log.warn(`Invalid server ${serverUrl}`);
        return null;
      }
      log.info(`set token ${thisServer.token}`);

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
    let thisServer;
    let i = 0;
    for (; i < this.servers.length; i += 1) {
      if (this.servers[i].baseServerUrl === serverUrl) {
        thisServer = this.servers[i];
        break;
      }
    }

    if (!thisServer) {
      log.warn(`Tried to unregister from nonexistent server ${serverUrl}`);
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

module.exports = LokiPublicChatFactoryAPI;
