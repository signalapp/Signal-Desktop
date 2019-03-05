const http = require('http');
const EventEmitter = require('events');

const STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  INTERNAL_SERVER_ERROR: 500,
};

class LocalLokiServer extends EventEmitter {
  /**
   * Creates an instance of LocalLokiServer.
   * Sends out a `message` event when a new message is received.
   */
  constructor() {
    super();
    this.server = http.createServer((req, res) => {
      let body = [];

      const sendResponse = (statusCode, message = null) => {
        const headers = message && {
          'Content-Type': 'text/plain',
        };
        res.writeHead(statusCode, headers);
        res.end(message);
      };

      if (req.method !== 'POST') {
        sendResponse(STATUS.METHOD_NOT_ALLOWED);
        return;
      }

      // Check endpoints
      req
        .on('error', () => {
          // Internal server error
          sendResponse(STATUS.INTERNAL_SERVER_ERROR);
        })
        .on('data', chunk => {
          body.push(chunk);
        })
        .on('end', () => {
          try {
            body = Buffer.concat(body).toString();
          } catch (e) {
            // Internal server error: failed to convert body to string
            sendResponse(STATUS.INTERNAL_SERVER_ERROR);
          }

          // Check endpoints here
          if (req.url === '/v1/storage_rpc') {
            try {
              const bodyObject = JSON.parse(body);
              if (bodyObject.method !== 'store') {
                sendResponse(STATUS.NOT_FOUND, 'Invalid endpoint!');
                return;
              }
              this.emit('message', bodyObject.params.data);
              sendResponse(STATUS.OK);
            } catch (e) {
              // Bad Request: Failed to decode json
              sendResponse(STATUS.BAD_REQUEST, 'Failed to decode JSON');
            }
          } else {
            sendResponse(STATUS.NOT_FOUND, 'Invalid endpoint!');
          }
        });
    });
  }

  async start(port, ip) {
    // Close the old server
    await this.close();

    // Start a listening on new server
    return new Promise((res, rej) => {
      this.server.listen(port, ip, err => {
        if (err) {
          rej(err);
        } else {
          res(this.server.address().port);
        }
      });
    });
  }

  // Async wrapper for http server close
  close() {
    if (this.server) {
      return new Promise(res => {
        this.server.close(() => res());
      });
    }

    return Promise.resolve();
  }

  getPort() {
    if (this.server.listening) {
      return this.server.address().port;
    }

    return null;
  }
}

module.exports = LocalLokiServer;
