describe('TextSecureWebSocket', function() {
  var RealWebSocket = window.WebSocket;
  before(function() {
    window.WebSocket = MockSocket;
  });
  after(function() {
    window.WebSocket = RealWebSocket;
  });
  it('connects and disconnects', function(done) {
    var mockServer = new MockServer('ws://localhost:8080');
    mockServer.on('connection', function(server) {
      socket.close();
      server.close();
      done();
    });
    var socket = new TextSecureWebSocket('ws://localhost:8080');
  });

  it('sends and receives', function(done) {
    var mockServer = new MockServer('ws://localhost:8080');
    mockServer.on('connection', function(server) {
      server.on('message', function(data) {
        server.send('ack');
        server.close();
      });
    });
    var socket = new TextSecureWebSocket('ws://localhost:8080');
    socket.onmessage = function(response) {
      assert.strictEqual(response.data, 'ack');
      socket.close();
      done();
    };
    socket.send('syn');
  });

  it('exposes the socket status', function(done) {
    var mockServer = new MockServer('ws://localhost:8082');
    mockServer.on('connection', function(server) {
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
    var mockServer = new MockServer('ws://localhost:8082');
    var socket = new TextSecureWebSocket('ws://localhost:8082');
    socket.onclose = function() {
      var mockServer = new MockServer('ws://localhost:8082');
      mockServer.on('connection', function(server) {
        socket.close();
        server.close();
        done();
      });
    };
    mockServer.close();
  });
});
