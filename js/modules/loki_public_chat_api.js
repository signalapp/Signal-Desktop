/* global log, textsecure, libloki, Signal, Whisper, Headers, ConversationController */
const EventEmitter = require('events');
const nodeFetch = require('node-fetch');
const { URL, URLSearchParams } = require('url');

// Can't be less than 1200 if we have unauth'd requests
const GROUPCHAT_POLL_EVERY = 1500; // 1.5s
const DELETION_POLL_EVERY = 5000; // 1 second

// singleton to relay events to libtextsecure/message_receiver
class LokiPublicChatAPI extends EventEmitter {
  constructor(ourKey) {
    super();
    this.ourKey = ourKey;
    this.servers = [];
  }
  findOrCreateServer(serverUrl) {
    let thisServer = this.servers.find(
      server => server.baseServerUrl === serverUrl
    );
    if (!thisServer) {
      log.info(`LokiPublicChatAPI creating ${serverUrl}`);
      thisServer = new LokiPublicServerAPI(this, serverUrl);
      this.servers.push(thisServer);
    }
    return thisServer;
  }
  findOrCreateChannel(serverUrl, channelId, conversationId) {
    const server = this.findOrCreateServer(serverUrl);
    return server.findOrCreateChannel(channelId, conversationId);
  }
  unregisterChannel(serverUrl, channelId) {
    let thisServer;
    let i = 0;
    for (; i < this.servers.length; i += 1) {
      if (this.servers[i].server === serverUrl) {
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
}

class LokiPublicServerAPI {
  constructor(chatAPI, url) {
    this.chatAPI = chatAPI;
    this.channels = [];
    this.tokenPromise = null;
    this.baseServerUrl = url;
  }
  findOrCreateChannel(channelId, conversationId) {
    let thisChannel = this.channels.find(
      channel => channel.channelId === channelId
    );
    if (!thisChannel) {
      log.info(`LokiPublicChatAPI creating channel ${conversationId}`);
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

  async getOrRefreshServerToken() {
    if (this.token) {
      return this.token;
    }
    let token = await Signal.Data.getPublicServerTokenByServerUrl(
      this.baseServerUrl
    );
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
    return token;
  }

  async refreshServerToken() {
    if (this.tokenPromise === null) {
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
    this.tokenPromise = null;
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
    const token = await libloki.crypto.decryptToken(body);
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

    try {
      const res = await nodeFetch(
        `${this.baseServerUrl}/loki/v1/submit_challenge`,
        options
      );
      return res.ok;
    } catch (e) {
      return false;
    }
  }
}

class LokiPublicChannelAPI {
  constructor(serverAPI, channelId, conversationId) {
    this.serverAPI = serverAPI;
    this.channelId = channelId;
    this.baseChannelUrl = `channels/${this.channelId}`;
    this.groupName = 'unknown';
    this.conversationId = conversationId;
    this.lastGot = 0;
    this.stopPolling = false;
    log.info(`registered LokiPublicChannel ${channelId}`);
    // start polling
    this.pollForMessages();
    this.deleteLastId = 1;
    this.pollForDeletions();
  }

  async refreshModStatus() {
    const url = new URL(`${this.serverAPI.baseServerUrl}/loki/v1/user_info`);
    const token = await this.serverAPI.getOrRefreshServerToken();
    let modStatus = false;
    try {
      const result = await nodeFetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (result.ok) {
        const response = await result.json();
        if (response.data.moderator_status) {
          modStatus = response.data.moderator_status;
        }
      }
    } catch (e) {
      modStatus = false;
    }
    const conversation = ConversationController.get(this.conversationId);
    await conversation.setModStatus(modStatus);
  }

  async deleteMessage(messageServerId) {
    // TODO: Allow deletion of your own messages without moderator status
    const url = new URL(
      `${
        this.serverAPI.baseServerUrl
      }/loki/v1/moderation/message/${messageServerId}`
    );
    const token = await this.serverAPI.getOrRefreshServerToken();
    try {
      const result = await nodeFetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      // 200 for successful delete
      // 404 for trying to delete a message that doesn't exist
      // 410 for successful moderator delete
      const validResults = [404, 410];
      if (result.ok || validResults.includes(result.status)) {
        return true;
      }
    } catch (e) {
      log.warn(
        `Failed to delete message from public server with ID ${messageServerId}`
      );
    }
    return false;
  }

  getEndpoint() {
    const endpoint = `${this.serverAPI.baseServerUrl}/${
      this.baseChannelUrl
    }/messages`;
    return endpoint;
  }

  async serverRequest(endpoint, params, method) {
    const url = new URL(`${this.serverAPI.baseServerUrl}/${endpoint}`);
    url.search = new URLSearchParams(params);
    let res;
    const token = await this.serverAPI.getOrRefreshServerToken();
    if (!token) {
      log.error('NO TOKEN');
      return {
        err: 'noToken',
      };
    }
    try {
      // eslint-disable-next-line no-await-in-loop
      const options = {
        headers: new Headers({
          Authorization: `Bearer ${token}`,
        }),
      };
      if (method) {
        options.method = method;
      }
      res = await nodeFetch(url, options || undefined);
    } catch (e) {
      log.info(`e ${e}`);
      return {
        err: e,
      };
    }
    // eslint-disable-next-line no-await-in-loop
    const response = await res.json();
    if (response.meta.code !== 200) {
      return {
        err: 'statusCode',
        response,
      };
    }
    return {
      response,
    };
  }

  async pollForDeletions() {
    // read all messages from 0 to current
    // delete local copies if server state has changed to delete
    // run every minute
    const pollAgain = () => {
      setTimeout(() => {
        this.pollForDeletions();
      }, DELETION_POLL_EVERY);
    };

    const params = {
      count: 200,
    };

    // full scan
    let more = true;
    while (more) {
      params.since_id = this.deleteLastId;
      const res = await this.serverRequest(
        `loki/v1/channel/${this.channelId}/deletes`,
        params
      );

      // eslint-disable-next-line no-loop-func
      res.response.data.reverse().forEach(deleteEntry => {
        Whisper.events.trigger('deleteLocalPublicMessage', {
          messageServerId: deleteEntry.message_id,
          conversationId: this.conversationId,
        });
      });
      if (res.response.data.length < 200) {
        break;
      }
      this.deleteLastId = res.response.meta.max_id;
      ({ more } = res.response);
    }
    pollAgain();
  }

  async pollForMessages() {
    const params = {
      include_annotations: 1,
      count: -20,
      include_deleted: false,
    };
    if (this.lastGot) {
      params.since_id = this.lastGot;
    }
    const res = await this.serverRequest(
      `${this.baseChannelUrl}/messages`,
      params
    );

    if (!res.err && res.response) {
      let receivedAt = new Date().getTime();
      res.response.data.reverse().forEach(adnMessage => {
        let timestamp = new Date(adnMessage.created_at).getTime();
        let from = adnMessage.user.username;
        let source;
        if (adnMessage.is_deleted) {
          return;
        }
        if (adnMessage.annotations !== []) {
          const noteValue = adnMessage.annotations[0].value;
          ({ from, timestamp, source } = noteValue);
        }

        if (
          !from ||
          !timestamp ||
          !source ||
          !adnMessage.id ||
          !adnMessage.text
        ) {
          return; // Invalid message
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
