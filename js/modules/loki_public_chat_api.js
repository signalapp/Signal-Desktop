/* global log, textsecure, libloki, Signal */
const EventEmitter = require('events');
const nodeFetch = require('node-fetch');
const { URL, URLSearchParams } = require('url');

const GROUPCHAT_POLL_EVERY = 1000; // 1 second

// singleton to relay events to libtextsecure/message_receiver
class LokiPublicChatAPI extends EventEmitter {
  constructor(ourKey) {
    super();
    this.ourKey = ourKey;
    this.lastGot = {};
    this.servers = [];
  }
  findOrCreateServer(hostport) {
    log.info(`LokiPublicChatAPI looking for ${hostport}`);
    let thisServer = this.servers.find(server => server.server === hostport);
    if (!thisServer) {
      thisServer = new LokiPublicServerAPI(this, hostport);
      this.servers.push(thisServer);
    }
    return thisServer;
  }
  registerChannel(hostport, channelId, conversationId) {
    const server = this.findOrCreateServer(hostport);
    server.findOrCreateChannel(channelId, conversationId);
  }
  unregisterChannel(hostport, channelId) {
    let thisServer;
    let i = 0;
    for (; i < this.servers.length; i += 1) {
      if (this.servers[i].server === hostport) {
        thisServer = this.servers[i];
        break;
      }
    }

    if (!thisServer) {
      log.warn(`Tried to unregister from nonexistent server ${hostport}`);
      return;
    }
    thisServer.unregisterChannel(channelId);
    this.servers.splice(i, 1);
  }
}

class LokiPublicServerAPI {
  constructor(chatAPI, hostport) {
    this.chatAPI = chatAPI;
    this.server = hostport;
    this.channels = [];
    this.tokenPending = false;
    this.tokenPromise = null;
    this.baseServerUrl = `https://${this.server}`;
  }
  findOrCreateChannel(channelId, conversationId) {
    let thisChannel = this.channels.find(
      channel => channel.channelId === channelId
    );
    if (!thisChannel) {
      thisChannel = new LokiPublicChannelAPI(this, channelId, conversationId);
      this.channels.push(thisChannel);
    }
    return thisChannel;
  }
  unregisterChannel(channelId) {
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
    this.channels.splice(i, 1);
    thisChannel.stopPolling = true;
  }

  async getServerToken() {
    let token = await Signal.Data.getPublicServerTokenByServerName(this.server);
    if (!token) {
      token = await this.getNewToken();
      if (token) {
        await Signal.Data.savePublicServerToken({
          server: this.server,
          token,
        });
      }
    }
    return token;
  }

  async getNewToken() {
    if (!this.tokenPending) {
      this.tokenPending = true;
      this.tokenPromise = new Promise(async res => {
        const token = await this.requestToken();
        if (!token) {
          res(null);
          return;
        }
        const registered = await this.submitToken(token);
        if (!registered) {
          res(null);
          return;
        }
        res(token);
      });
    }
    const token = await this.tokenPromise;
    this.tokenPending = false;
    return token;
  }

  async requestToken() {
    const url = new URL(`${this.baseServerUrl}/loki/v1/get_challenge`);
    const params = {
      pubKey: this.chatAPI.ourKey,
    };
    url.search = new URLSearchParams(params);

    let res;
    try {
      res = await nodeFetch(url);
    } catch (e) {
      return null;
    }
    if (!res.ok) {
      return null;
    }
    const body = await res.json();
    const { cipherText64, serverPubKey64 } = body;
    const token = await libloki.crypto.decryptToken(
      cipherText64,
      serverPubKey64
    );
    return token;
  }

  async submitToken(token) {
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pubKey: this.chatAPI.ourKey,
        token,
      }),
    };

    let res;
    let success = true;
    try {
      res = await nodeFetch(
        `${this.baseServerUrl}/loki/v1/submit_challenge`,
        options
      );
      success = res.ok;
    } catch (e) {
      return false;
    }
    return success;
  }
}

class LokiPublicChannelAPI {
  constructor(serverAPI, channelId, conversationId) {
    this.serverAPI = serverAPI;
    this.channelId = channelId;
    this.baseChannelUrl = `${serverAPI.baseServerUrl}/channels/${
      this.channelId
    }`;
    this.groupName = 'unknown';
    this.conversationId = conversationId;
    this.lastGot = 0;
    this.stopPolling = false;
    log.info(`registered LokiPublicChannel ${channelId}`);
    // start polling
    this.pollForMessages();
  }

  getEndpoint() {
    const endpoint = `https://${this.serverAPI.server}/channels/${
      this.channelId
    }/messages`;
    return endpoint;
  }

  async pollForChannel(source, endpoint) {
    // groupName will be loaded from server
    const url = new URL(this.baseChannelUrl);
    let res;
    let success = true;
    try {
      res = await nodeFetch(url);
    } catch (e) {
      success = false;
    }

    const response = await res.json();
    if (response.meta.code !== 200) {
      success = false;
    }
    // update this.groupId
    return endpoint || success;
  }

  async pollForDeletions() {
    // read all messages from 0 to current
    // delete local copies if server state has changed to delete
    // run every minute
    const url = new URL(this.baseChannelUrl);
    let res;
    let success = true;
    try {
      res = await nodeFetch(url);
    } catch (e) {
      success = false;
    }

    const response = await res.json();
    if (response.meta.code !== 200) {
      success = false;
    }
    return success;
  }

  async pollForMessages() {
    const url = new URL(`${this.baseChannelUrl}/messages`);
    const params = {
      include_annotations: 1,
      count: -20,
    };
    if (this.lastGot) {
      params.since_id = this.lastGot;
    }
    url.search = new URLSearchParams(params);

    let res;
    let success = true;
    try {
      res = await nodeFetch(url);
    } catch (e) {
      success = false;
    }

    const response = await res.json();
    if (this.stopPolling) {
      // Stop after latest await possible
      return;
    }
    if (response.meta.code !== 200) {
      success = false;
    }

    if (success) {
      let receivedAt = new Date().getTime();
      response.data.reverse().forEach(adnMessage => {
        let timestamp = new Date(adnMessage.created_at).getTime();
        let from = adnMessage.user.username;
        let source;
        if (adnMessage.annotations.length) {
          const noteValue = adnMessage.annotations[0].value;
          ({ from, timestamp, source } = noteValue);
        }

        const messageData = {
          serverId: adnMessage.id,
          friendRequest: false,
          source,
          sourceDevice: 1,
          timestamp,
          serverTimestamp: timestamp,
          receivedAt,
          isPublic: true,
          message: {
            body: adnMessage.text,
            attachments: [],
            group: {
              id: this.conversationId,
              type: textsecure.protobuf.GroupContext.Type.DELIVER,
            },
            flags: 0,
            expireTimer: 0,
            profileKey: null,
            timestamp,
            received_at: receivedAt,
            sent_at: timestamp,
            quote: null,
            contact: [],
            preview: [],
            profile: {
              displayName: from,
            },
          },
        };
        receivedAt += 1; // Ensure different arrival times

        this.serverAPI.chatAPI.emit('publicMessage', {
          message: messageData,
        });
        this.lastGot = !this.lastGot
          ? adnMessage.id
          : Math.max(this.lastGot, adnMessage.id);
      });
    }

    setTimeout(() => {
      this.pollForMessages();
    }, GROUPCHAT_POLL_EVERY);
  }
}

module.exports = LokiPublicChatAPI;
