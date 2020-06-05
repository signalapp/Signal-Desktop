/* global window, dcodeIO, textsecure */

// eslint-disable-next-line func-names
(function() {
  let server;
  const EXHAUSTED_SNODES_RETRY_DELAY = 5000;
  const NUM_CONCURRENT_CONNECTIONS = 3;

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

  window.HttpResource = function HttpResource(_server, opts = {}) {
    server = _server;
    let { handleRequest } = opts;
    if (typeof handleRequest !== 'function') {
      handleRequest = request => request.respond(404, 'Not found');
    }
    let connected = true;
    this.calledStop = false;
    let resolveStopPolling;
    const stopPolling = new Promise(res => {
      resolveStopPolling = res;
    });

    this.handleMessage = (message, options = {}) => {
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
            options
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

    this.pollForAdditionalId = async groupId => {
      await server.pollForGroupId(groupId, messages => {
        messages.forEach(m => {
          this.handleMessage(m.data, { conversationId: m.conversationId });
        });
      });
    };

    this.pollServer = async () => {
      // bg.connect calls mr connect after storage system is ready
      window.log.info('http-resource pollServer start');
      // This blocking call will return only when all attempts
      // at reaching snodes are exhausted or a DNS error occured
      try {
        await server.startLongPolling(
          NUM_CONCURRENT_CONNECTIONS,
          stopPolling,
          messages => {
            if (this.calledStop) {
              return; // don't handle those messages
            }
            connected = true;
            messages.forEach(message => {
              this.handleMessage(message.data, {
                conversationId: message.conversationId,
              });
            });
          }
        );
      } catch (e) {
        // we'll try again anyway
        window.log.error(
          'http-resource pollServer error',
          e.code,
          e.message,
          e.stack
        );
      }
      connected = false;

      if (this.calledStop) {
        // don't restart
        return;
      }

      // Exhausted all our snodes urls, trying again later from scratch
      setTimeout(() => {
        if (this.calledStop) {
          return; // don't restart
        }
        window.log.info(
          `http-resource: Exhausted all our snodes urls, trying again in ${EXHAUSTED_SNODES_RETRY_DELAY /
            1000}s from scratch`
        );
        this.pollServer();
      }, EXHAUSTED_SNODES_RETRY_DELAY);
    };

    this.isConnected = function isConnected() {
      return connected;
    };

    this.close = () => {
      this.calledStop = true;
      resolveStopPolling(true);
    };
  };
})();
