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
    var socket = new TextSecureWebSocket('ws://localhost:8080');
  });

  it('sends and receives', done => {
    const mockServer = new MockServer('ws://localhost:8080');
    mockServer.on('connection', server => {
      server.on('message', data => {
        server.send('ack');
        server.close();
      });
    });
    const socket = new TextSecureWebSocket('ws://localhost:8080');
    socket.onmessage = function(response) {
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
    var socket = new TextSecureWebSocket('ws://localhost:8082');
    socket.onclose = function() {
      assert.strictEqual(socket.getStatus(), WebSocket.CLOSING);
      done();
    };
  });

  it('reconnects', function(done) {
    this.timeout(60000);
    const mockServer = new MockServer('ws://localhost:8082');
    const socket = new TextSecureWebSocket('ws://localhost:8082');
    socket.onclose = function() {
      const mockServer = new MockServer('ws://localhost:8082');
      mockServer.on('connection', server => {
        socket.close();
        server.close();
        done();
      });
    };
    mockServer.close();
  });
});
