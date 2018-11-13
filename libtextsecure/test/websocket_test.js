/* global TextSecureWebSocket */

describe('TextSecureWebSocket', () => {
  const RealWebSocket = window.WebSocket;
  before(() => {
    window.WebSocket = MockSocket;
  });
  after(() => {
    window.WebSocket = RealWebSocket;
  });
  it('connects and disconnects', done => {
    const mockServer = new MockServer('ws://localhost:8080');
    mockServer.on('connection', server => {
      socket.close();
      server.close();
      done();
    });
    const socket = new TextSecureWebSocket('ws://localhost:8080');
  });

  it('sends and receives', done => {
    const mockServer = new MockServer('ws://localhost:8080');
    mockServer.on('connection', server => {
      server.on('message', () => {
        server.send('ack');
        server.close();
      });
    });
    const socket = new TextSecureWebSocket('ws://localhost:8080');
    socket.onmessage = response => {
      assert.strictEqual(response.data, 'ack');
      socket.close();
      done();
    };
    socket.send('syn');
  });

  it('exposes the socket status', done => {
    const mockServer = new MockServer('ws://localhost:8082');
    mockServer.on('connection', server => {
      assert.strictEqual(socket.getStatus(), WebSocket.OPEN);
      server.close();
      socket.close();
    });
    const socket = new TextSecureWebSocket('ws://localhost:8082');
    socket.onclose = () => {
      assert.strictEqual(socket.getStatus(), WebSocket.CLOSING);
      done();
    };
  });

  it('reconnects', function thisNeeded(done) {
    this.timeout(60000);
    const mockServer = new MockServer('ws://localhost:8082');
    const socket = new TextSecureWebSocket('ws://localhost:8082');
    socket.onclose = () => {
      const secondServer = new MockServer('ws://localhost:8082');
      secondServer.on('connection', server => {
        socket.close();
        server.close();
        done();
      });
    };
    mockServer.close();
  });
});
