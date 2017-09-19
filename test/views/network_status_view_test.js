
describe('NetworkStatusView', function() {
    describe('getNetworkStatus', function() {
        var networkStatusView;
        var socketStatus = WebSocket.OPEN;

        var oldGetSocketStatus;

        /* BEGIN stubbing globals */
        before(function() {
            oldGetSocketStatus = window.getSocketStatus;
            window.getSocketStatus = function() { return socketStatus; };
        });

        after(function() {
            window.getSocketStatus = oldGetSocketStatus;
        });
        /* END stubbing globals */

        beforeEach(function() {
            networkStatusView = new Whisper.NetworkStatusView();

            $('.network-status-container').append(networkStatusView.el);
        });
        afterEach(function() {
            // prevents huge number of errors on console after running tests
            clearInterval(networkStatusView.renderIntervalHandle);
            networkStatusView = null;
        });

        describe('initialization', function() {
            it('should have an empty interval', function() {
                assert.equal(networkStatusView.socketReconnectWaitDuration.asSeconds(), 0);
            });
        });
        describe('network status with no connection', function() {
            beforeEach(function() {
                networkStatusView.navigatorOnLine = function() { return false; };
            });
            it('should be interrupted', function() {
                networkStatusView.update();
                var status = networkStatusView.getNetworkStatus();
                assert(status.hasInterruption);
                assert.equal(status.instructions, "Check your network connection.");
            });
            it('should display an offline message', function() {
                networkStatusView.update();
                assert.match(networkStatusView.$el.text(), /Offline/);
            });
            it('should override socket status', function() {
                _([WebSocket.CONNECTING,
                   WebSocket.OPEN,
                   WebSocket.CLOSING,
                   WebSocket.CLOSED]).map(function(socketStatusVal) {
                    socketStatus = socketStatusVal;
                    networkStatusView.update();
                    assert.match(networkStatusView.$el.text(), /Offline/);
                });
            });
            it('should override registration status', function() {
                Whisper.Registration.remove();
                networkStatusView.update();
                assert.match(networkStatusView.$el.text(), /Offline/);
            });
        });
        describe('network status when registration is not done', function() {
            beforeEach(function() {
                Whisper.Registration.remove();
            });
            it('should display an unlinked message', function() {
                networkStatusView.update();
                assert.match(networkStatusView.$el.text(), /Relink/);
            });
            it('should override socket status', function() {
                _([WebSocket.CONNECTING,
                   WebSocket.OPEN,
                   WebSocket.CLOSING,
                   WebSocket.CLOSED]).map(function(socketStatusVal) {
                    socketStatus = socketStatusVal;
                    networkStatusView.update();
                    assert.match(networkStatusView.$el.text(), /Relink/);
                });
            });
        });
        describe('network status when registration is done', function() {
            beforeEach(function() {
                networkStatusView.navigatorOnLine = function() { return true; };
                Whisper.Registration.markDone();
                networkStatusView.update();
            });
            it('should not display an unlinked message', function() {
                networkStatusView.update();
                assert.notMatch(networkStatusView.$el.text(), /Relink/);
            });
        });
        describe('network status when socket is connecting', function() {
            beforeEach(function() {
                Whisper.Registration.markDone();
                socketStatus = WebSocket.CONNECTING;
                networkStatusView.update();
            });
            it('it should display a connecting string if connecting and not in the connecting grace period', function() {
                networkStatusView.withinConnectingGracePeriod = false;
                var status = networkStatusView.getNetworkStatus();

                assert.match(networkStatusView.$el.text(), /Connecting/);
            });
            it('it should not be interrupted if in connecting grace period', function() {
                assert(networkStatusView.withinConnectingGracePeriod);
                var status = networkStatusView.getNetworkStatus();

                assert.match(networkStatusView.$el.text(), /Connecting/);
                assert(!status.hasInterruption);
            });
            it('it should be interrupted if connecting grace period is over', function() {
                // Pretend like we've been offline for a minute already
                networkStatusView.offlineStart = Date.now() - 60 * 1000;

                networkStatusView.withinConnectingGracePeriod = false;
                var status = networkStatusView.getNetworkStatus();

                assert(status.hasInterruption);
            });
        });
        describe('network status when socket is open', function() {
            before(function() {
                socketStatus = WebSocket.OPEN;
            });
            it('should not be interrupted', function() {
                var status = networkStatusView.getNetworkStatus();
                assert(!status.hasInterruption);
                assert.match(networkStatusView.$el.find('.network-status-message').text().trim(), /^$/);
            });
        });
        describe('network status when socket is closed or closing', function() {
            _([WebSocket.CLOSED, WebSocket.CLOSING]).map(function(socketStatusVal) {
                it('should be interrupted if offline for 60s, state ' + socketStatusVal, function() {
                    // Pretend like we've been offline for a minute already
                    networkStatusView.offlineStart = Date.now() - 60 * 1000;

                    socketStatus = socketStatusVal;
                    networkStatusView.update();
                    var status = networkStatusView.getNetworkStatus();
                    assert(status.hasInterruption);
                });

                it('should be interrupted if offline for 5s, state ' + socketStatusVal, function() {
                    // Pretend like we've been offline for a minute already
                    networkStatusView.offlineStart = Date.now() - 5 * 1000;

                    socketStatus = socketStatusVal;
                    networkStatusView.update();
                    var status = networkStatusView.getNetworkStatus();
                    assert(status.hasInterruption);
                });

                it('should not be interrupted if newly offline, state ' + socketStatusVal, function() {
                    socketStatus = socketStatusVal;
                    networkStatusView.update();
                    var status = networkStatusView.getNetworkStatus();
                    assert(!status.hasInterruption);
                });
            });
        });
        describe('the socket reconnect interval', function() {
            beforeEach(function() {
                socketStatus = WebSocket.CLOSED;
                networkStatusView.setSocketReconnectInterval(61000);
                networkStatusView.update();
            });
            it('should format the message based on the socketReconnectWaitDuration property', function() {
                assert.equal(networkStatusView.socketReconnectWaitDuration.asSeconds(), 61);
                assert.match(networkStatusView.$('.network-status-message:last').text(), /Attempting reconnect/);
            });
            it('should be reset by changing the socketStatus to CONNECTING', function() {
                socketStatus = WebSocket.CONNECTING;
                networkStatusView.update();
                assert.equal(networkStatusView.socketReconnectWaitDuration.asSeconds(), 0);
            });
        });
    });
});
