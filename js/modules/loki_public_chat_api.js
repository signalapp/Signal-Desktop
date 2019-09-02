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

  // server getter/factory
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

  // channel getter/factory
  findOrCreateChannel(serverUrl, channelId, conversationId) {
    const server = this.findOrCreateServer(serverUrl);
    return server.findOrCreateChannel(channelId, conversationId);
  }

  // deallocate resources server uses
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
    const ref = this;
    (async function justToEnableAsyncToGetToken() {
      ref.token = await ref.getOrRefreshServerToken();
      log.info(`set token ${ref.token}`);
    })();
  }

  // channel getter/factory
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

  // deallocate resources channel uses
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
    return token;
  }

  // get active token from server (but only allow one request at a time)
  async refreshServerToken() {
    // if currently not in progress
    if (this.tokenPromise === null) {
      // set lock
      this.tokenPromise = new Promise(async res => {
        // request the oken
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

  // activate token
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
    // properties
    this.serverAPI = serverAPI;
    this.channelId = channelId;
    this.baseChannelUrl = `channels/${this.channelId}`;
    this.groupName = 'unknown';
    this.conversationId = conversationId;
    this.lastGot = null;
    this.stopPolling = false;
    this.modStatus = false;
    this.deleteLastId = 1;
    // end properties

    log.info(`registered LokiPublicChannel ${channelId}`);
    // start polling
    this.pollForMessages();
    this.pollForDeletions();
  }

  // make a request to the server
  async serverRequest(endpoint, options = {}) {
    const { params = {}, method, objBody, forceFreshToken = false } = options;
    const url = new URL(`${this.serverAPI.baseServerUrl}/${endpoint}`);
    if (params) {
      url.search = new URLSearchParams(params);
    }
    let result;
    let { token } = this.serverAPI;
    if (!token) {
      token = await this.serverAPI.getOrRefreshServerToken();
      if (!token) {
        log.error('NO TOKEN');
        return {
          err: 'noToken',
        };
      }
    }
    try {
      const fetchOptions = {};
      const headers = {
        Authorization: `Bearer ${this.serverAPI.token}`,
      };
      if (method) {
        fetchOptions.method = method;
      }
      if (objBody) {
        headers['Content-Type'] = 'application/json';
        fetchOptions.body = JSON.stringify(objBody);
      }
      fetchOptions.headers = new Headers(headers);
      result = await nodeFetch(url, fetchOptions || undefined);
    } catch (e) {
      log.info(`e ${e}`);
      return {
        err: e,
      };
    }
    let response = null;
    try {
      response = await result.json();
    } catch (e) {
      log.info(`serverRequest json arpse ${e}`);
      return {
        err: e,
        statusCode: result.status,
      };
    }

    // if it's a response style with a meta
    if (result.status !== 200) {
      if (!forceFreshToken && response.meta.code === 401) {
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

  // get moderator status
  async refreshModStatus() {
    const res = this.serverRequest('loki/v1/user_info');
    // if no problems and we have data
    if (!res.err && res.response && res.response.data) {
      this.modStatus = res.response.data.moderator_status;
    }

    const conversation = ConversationController.get(this.conversationId);
    await conversation.setModStatus(this.modStatus);
  }

  // delete a message on the server
  async deleteMessage(serverId) {
    const res = await this.serverRequest(
      this.modStatus
        ? `loki/v1/moderation/message/${serverId}`
        : `${this.baseChannelUrl}/messages/${serverId}`,
      { method: 'DELETE' }
    );
    if (!res.err && res.response) {
      log.info(`deleted ${serverId} on ${this.baseChannelUrl}`);
      return true;
    }
    log.warn(`failed to delete ${serverId} on ${this.baseChannelUrl}`);
    return false;
  }

  // used for sending messages
  getEndpoint() {
    const endpoint = `${this.serverAPI.baseServerUrl}/${
      this.baseChannelUrl
    }/messages`;
    return endpoint;
  }

  // update room details
  async pollForChannel() {
    // groupName will be loaded from server
    const url = new URL(this.baseChannelUrl);
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

  // get moderation actions
  async pollForDeletions() {
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

      // Process results
      res.response.data.reverse().forEach(deleteEntry => {
        // Escalate it up to the subsystem that can check to see if this has
        // been processed
        Whisper.events.trigger('deleteLocalPublicMessage', {
          messageServerId: deleteEntry.message_id,
          conversationId: this.conversationId,
        });
      });

      // if we had a problem break the loop
      if (res.response.data.length < 200) {
        break;
      }

      // update where we last checked
      this.deleteLastId = res.response.meta.max_id;
      ({ more } = res.response);
    }

    // set up next poll
    setTimeout(() => {
      this.pollForDeletions();
    }, DELETION_POLL_EVERY);
  }

  // get channel messages
  async pollForMessages() {
    const params = {
      include_annotations: 1,
      count: -20,
      include_deleted: false,
    };
    const conversation = ConversationController.get(this.conversationId);
    if (!conversation) {
      log.warn('Trying to poll for non-existing public conversation');
      this.lastGot = 0;
    } else if (!this.lastGot) {
      this.lastGot = conversation.getLastRetrievedMessage();
    }
    params.since_id = this.lastGot;
    const res = await this.serverRequest(`${this.baseChannelUrl}/messages`, {
      params,
    });

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
        conversation.setLastRetrievedMessage(this.lastGot);
      });
    }

    setTimeout(() => {
      this.pollForMessages();
    }, GROUPCHAT_POLL_EVERY);
  }

  // create a message in the channel
  async sendMessage(text, messageTimeStamp, displayName, pubKey) {
    const payload = {
      text,
      annotations: [
        {
          type: 'network.loki.messenger.publicChat',
          value: {
            timestamp: messageTimeStamp,
            // will deprecated
            from: displayName,
            // will deprecated
            source: pubKey,
          },
        },
      ],
    };
    const res = await this.serverRequest(`${this.baseChannelUrl}/messages`, {
      method: 'POST',
      objBody: payload,
    });
    if (!res.err && res.response) {
      return res.response.data.id;
    }
    return false;
  }
}

module.exports = LokiPublicChatAPI;
