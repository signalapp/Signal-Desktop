/* global _, $, Whisper */

describe('NetworkStatusView', () => {
  describe('getNetworkStatus', () => {
    let networkStatusView;
    let socketStatus = WebSocket.OPEN;

    let oldGetSocketStatus;

    /* BEGIN stubbing globals */
    before(() => {
      oldGetSocketStatus = window.getSocketStatus;
      window.getSocketStatus = () => socketStatus;
    });

    after(() => {
      window.getSocketStatus = oldGetSocketStatus;

      // It turns out that continued calls to window.getSocketStatus happen
      //   because we host NetworkStatusView in three mock interfaces, and the view
      //   checks every N seconds. That results in infinite errors unless there is
      //   something to call.
      window.getSocketStatus = () => WebSocket.OPEN;
    });
    /* END stubbing globals */

    beforeEach(() => {
      networkStatusView = new Whisper.NetworkStatusView();
      $('.network-status-container').append(networkStatusView.el);
    });
    afterEach(() => {
      // prevents huge number of errors on console after running tests
      clearInterval(networkStatusView.renderIntervalHandle);
      networkStatusView = null;
    });

    describe('initialization', () => {
      it('should have an empty interval', () => {
        assert.equal(
          networkStatusView.socketReconnectWaitDuration.asSeconds(),
          0
        );
      });
    });
    describe('network status with no connection', () => {
      beforeEach(() => {
        networkStatusView.navigatorOnLine = () => false;
      });
      it('should be interrupted', () => {
        networkStatusView.update();
        const status = networkStatusView.getNetworkStatus();
        assert(status.hasInterruption);
        assert.equal(status.instructions, 'Check your network connection.');
      });
      it('should display an offline message', () => {
        networkStatusView.update();
        assert.match(networkStatusView.$el.text(), /Offline/);
      });
      it('should override socket status', () => {
        _([
          WebSocket.CONNECTING,
          WebSocket.OPEN,
          WebSocket.CLOSING,
          WebSocket.CLOSED,
        ]).forEach(socketStatusVal => {
          socketStatus = socketStatusVal;
          networkStatusView.update();
          assert.match(networkStatusView.$el.text(), /Offline/);
        });
      });
      it('should override registration status', () => {
        Whisper.Registration.remove();
        networkStatusView.update();
        assert.match(networkStatusView.$el.text(), /Offline/);
      });
    });
    describe('network status when registration is not done', () => {
      beforeEach(() => {
        Whisper.Registration.remove();
      });
      it('should display an unlinked message', () => {
        networkStatusView.update();
        assert.match(networkStatusView.$el.text(), /Relink/);
      });
      it('should override socket status', () => {
        _([
          WebSocket.CONNECTING,
          WebSocket.OPEN,
          WebSocket.CLOSING,
          WebSocket.CLOSED,
        ]).forEach(socketStatusVal => {
          socketStatus = socketStatusVal;
          networkStatusView.update();
          assert.match(networkStatusView.$el.text(), /Relink/);
        });
      });
    });
    describe('network status when registration is done', () => {
      beforeEach(() => {
        networkStatusView.navigatorOnLine = () => true;
        Whisper.Registration.markDone();
        networkStatusView.update();
      });
      it('should not display an unlinked message', () => {
        networkStatusView.update();
        assert.notMatch(networkStatusView.$el.text(), /Relink/);
      });
    });
    describe('network status when socket is connecting', () => {
      beforeEach(() => {
        Whisper.Registration.markDone();
        socketStatus = WebSocket.CONNECTING;
        networkStatusView.update();
      });
      it('it should display a connecting string if connecting and not in the connecting grace period', () => {
        networkStatusView.withinConnectingGracePeriod = false;
        networkStatusView.getNetworkStatus();

        assert.match(networkStatusView.$el.text(), /Connecting/);
      });
      it('it should not be interrupted if in connecting grace period', () => {
        assert(networkStatusView.withinConnectingGracePeriod);
        const status = networkStatusView.getNetworkStatus();

        assert.match(networkStatusView.$el.text(), /Connecting/);
        assert(!status.hasInterruption);
      });
      it('it should be interrupted if connecting grace period is over', () => {
        networkStatusView.withinConnectingGracePeriod = false;
        const status = networkStatusView.getNetworkStatus();

        assert(status.hasInterruption);
      });
    });
    describe('network status when socket is open', () => {
      before(() => {
        socketStatus = WebSocket.OPEN;
      });
      it('should not be interrupted', () => {
        const status = networkStatusView.getNetworkStatus();
        assert(!status.hasInterruption);
        assert.match(
          networkStatusView.$el
            .find('.network-status-message')
            .text()
            .trim(),
          /^$/
        );
      });
    });
    describe('network status when socket is closed or closing', () => {
      _([WebSocket.CLOSED, WebSocket.CLOSING]).forEach(socketStatusVal => {
        it('should be interrupted', () => {
          socketStatus = socketStatusVal;
          networkStatusView.update();
          const shortCircuit = true;
          const status = networkStatusView.getNetworkStatus(shortCircuit);
          assert(status.hasInterruption);
        });
      });
    });
    describe('the socket reconnect interval', () => {
      beforeEach(() => {
        socketStatus = WebSocket.CLOSED;
        networkStatusView.setSocketReconnectInterval(61000);
        networkStatusView.update();
      });
      it('should format the message based on the socketReconnectWaitDuration property', () => {
        assert.equal(
          networkStatusView.socketReconnectWaitDuration.asSeconds(),
          61
        );
        assert.match(
          networkStatusView.$('.network-status-message:last').text(),
          /Attempting reconnect/
        );
      });
      it('should be reset by changing the socketStatus to CONNECTING', () => {});
    });
  });
});
