/* global window, dcodeIO, textsecure */

// eslint-disable-next-line func-names
(function() {
  let server;
  const development = window.getEnvironment() !== 'production';
  const pollTime = development ? 100 : 5000;

  function stringToArrayBufferBase64(string) {
    return dcodeIO.ByteBuffer.wrap(string, 'base64').toArrayBuffer();
  }

  const Response = function Response(options) {
    this.verb = options.verb || options.type;
    this.path = options.path || options.url;
    this.body = options.body || options.data;
    this.success = options.success;
    this.error = options.error;
    this.id = options.id;

    if (this.id === undefined) {
      const bits = new Uint32Array(2);
      window.crypto.getRandomValues(bits);
      this.id = dcodeIO.Long.fromBits(bits[0], bits[1], true);
    }

    if (this.body === undefined) {
      this.body = null;
    }
  };

  const IncomingHttpResponse = function IncomingHttpResponse(options) {
    const request = new Response(options);

    this.verb = request.verb;
    this.path = request.path;
    this.body = request.body;

    this.respond = (status, message) => {
      // Mock websocket response
      window.log.info(status, message);
    };
  };

  const filterIncomingMessages = async function filterIncomingMessages(
    messages
  ) {
    const incomingHashes = messages.map(m => m.hash);
    const dupHashes = await window.Signal.Data.getSeenMessagesByHashList(
      incomingHashes
    );
    const newMessages = messages.filter(m => !dupHashes.includes(m.hash));
    const newHashes = newMessages.map(m => ({
      expiresAt: m.expiration,
      hash: m.hash,
    }));
    await window.Signal.Data.saveSeenMessageHashes(newHashes);
    return newMessages;
  };

  window.HttpResource = function HttpResource(_server, opts = {}) {
    server = _server;
    let { handleRequest } = opts;
    if (typeof handleRequest !== 'function') {
      handleRequest = request => request.respond(404, 'Not found');
    }
    let connected = false;
    const jobQueue = new window.JobQueue();

    const processMessages = async messages => {
      const newMessages = await jobQueue.add(
        () => filterIncomingMessages(messages)
      );
      newMessages.forEach(async message => {
        const { data } = message;
        this.handleMessage(data);
      });
    };

    this.handleMessage = (message, isP2p = false) => {
      try {
        const dataPlaintext = stringToArrayBufferBase64(message);
        const messageBuf = textsecure.protobuf.WebSocketMessage.decode(
          dataPlaintext
        );
        if (
          messageBuf.type === textsecure.protobuf.WebSocketMessage.Type.REQUEST
        ) {
          handleRequest(
            new IncomingHttpResponse({
              verb: messageBuf.request.verb,
              path: messageBuf.request.path,
              body: messageBuf.request.body,
              id: messageBuf.request.id,
            }),
            isP2p
          );
        }
      } catch (error) {
        const info = {
          message,
          error: error.message,
        };
        window.log.warn('HTTP-Resources Failed to handle message:', info);
      }
    };

    this.startPolling = async function pollServer(callback) {
      try {
        await server.retrieveMessages(processMessages);
        connected = true;
      } catch (err) {
        connected = false;
      }
      callback(connected);
      setTimeout(() => {
        pollServer(callback);
      }, pollTime);
    };

    this.isConnected = function isConnected() {
      return connected;
    };
  };
})();
