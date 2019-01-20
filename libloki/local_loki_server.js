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
            body = Buffer.concat(body).toString();

            // Check endpoints here
            if (req.url === '/store') {
              // body is a base64 encoded string
              this.emit('message', body);
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

  async start(port) {
    // Close the old server
    await this.close();

    // Start a listening on new server
    return new Promise((res, rej) => {
      this.server.listen(port, err => {
        if (err) {
          rej(err);
        } else {
          res(port);
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
}

exports.LocalLokiServer = LocalLokiServer;
