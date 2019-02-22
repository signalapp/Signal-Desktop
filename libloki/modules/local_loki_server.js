const http = require('http');
const EventEmitter = require('events');

class LocalLokiServer extends EventEmitter {
  /**
   * Creates an instance of LocalLokiServer.
   * Sends out a `message` event when a new message is received.
   */
  constructor() {
    super();
    this.server = http.createServer((req, res) => {
      let body = [];

      // Check endpoints
      if (req.method === 'POST') {
        req
          .on('error', () => {
            // Internal server error
            res.statusCode = 500;
            res.end();
          })
          .on('data', chunk => {
            body.push(chunk);
          })
          .on('end', () => {
            try {
              body = Buffer.concat(body).toString();
            } catch (e) {
              // Error occurred while converting to string
              res.statusCode = 500;
              res.end();
            }

            // Check endpoints here
            if (req.url === '/v1/storage_rpc') {
              const bodyObject = JSON.parse(body);
              if (bodyObject.method !== 'store') {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Invalid endpoint!');
                return;
              }
              this.emit('message', bodyObject.params.data);
              res.statusCode = 200;
              res.end();
            } else {
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.end('Invalid endpoint!');
            }
          });
      } else {
        // Method Not Allowed
        res.statusCode = 405;
        res.end();
      }
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
    this.removeAllListeners();
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
