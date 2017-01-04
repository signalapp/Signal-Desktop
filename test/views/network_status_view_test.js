
describe('NetworkStatusView', function() {
    describe('getNetworkStatus', function() {
        var networkStatusView;
        var socketStatus = WebSocket.OPEN;

        var oldGetMessage;
        var oldGetSocketStatus;

        /* BEGIN stubbing globals */ 
        before(function(){
            oldGetSocketStatus = window.getSocketStatus;
            /* chrome i18n support is missing in 'regular' webpages */
            window.chrome.i18n = { getMessage: function(message){ return message; }};
            window.getSocketStatus = function(){ return socketStatus; }
        });

        after(function(){
            window.getSocketStatus = oldGetSocketStatus;
        });
        /* END stubbing globals */ 

        beforeEach(function(done) {

            networkStatusView = new Whisper.NetworkStatusView();
            $('.network-status-container').append(networkStatusView.el)
            // stubbing global
            done();
        });
        describe('initialization', function(){
            it('should have an empty interval', function(){
                assert.equal(networkStatusView.socketReconnectWaitDuration.asSeconds(), 0);
            });
        });
        describe('network status with no connection', function() {
            beforeEach(function(){
                networkStatusView.navigatorOnLine = function(){ return false; }
            });
            it('should be interrupted', function() {
                networkStatusView.render();
                var status = networkStatusView.getNetworkStatus();
                assert(status.hasInterruption);
                assert.equal(status.reconnectDurationAsSeconds, 0);
            });
            it('should display an offline message', function(){
                networkStatusView.render();
                assert.match(networkStatusView.$el.text(), /offline/)
            });
            it('should override socket status', function(){
                _([WebSocket.CONNECTING,
                   WebSocket.OPEN,
                   WebSocket.CLOSING,
                   WebSocket.CLOSED]).map(function(socketStatusVal){
                    socketStatus = socketStatusVal;
                    networkStatusView.render();
                    assert.match(networkStatusView.$el.text(), /offline/)
                });
            });
        });
        describe('network status when socket is connecting', function() {
            beforeEach(function(){
                socketStatus = WebSocket.CONNECTING;
                networkStatusView.render();
            })
            it('it should display a connecting string if connecting and not in the connecting grace period', function() {
                networkStatusView.withinConnectingGracePeriod = false;
                var status = networkStatusView.getNetworkStatus();

                assert.match(networkStatusView.$el.text(), /connecting/)
            });
            it('it should not be interrupted if in connecting grace period', function() {
                assert(networkStatusView.withinConnectingGracePeriod);
                var status = networkStatusView.getNetworkStatus();

                assert.match(networkStatusView.$el.text(), /connecting/)
                assert(!status.hasInterruption);
            });
            it('it should be interrupted if connecting grace period is over', function() {
                networkStatusView.withinConnectingGracePeriod = false;
                var status = networkStatusView.getNetworkStatus();

                assert(status.hasInterruption);
            });
        });
        describe('network status when socket is open', function() {
            before(function(){
                socketStatus = WebSocket.OPEN;
            });
            it('should not be interrupted', function() {
                var status = networkStatusView.getNetworkStatus();
                assert(!status.hasInterruption);
                assert.match(networkStatusView.$el.find('.network-status-message').text().trim(), /^$/)
            });
        });
        describe('network status when socket is closed or closing', function(){
            _([WebSocket.CLOSED, WebSocket.CLOSING]).map(function(socketStatusVal){
                it('should be interrupted', function(){
                    socketStatus = socketStatusVal;
                    networkStatusView.render();
                    var status = networkStatusView.getNetworkStatus();
                    assert(status.hasInterruption);
                });

            });
        });
        describe('the socket reconnect interval', function(){
            beforeEach(function(){
                socketStatus = WebSocket.CLOSED;
                networkStatusView.setSocketReconnectInterval(61000);
                networkStatusView.render();
            })
            it('should format the message based on the socketReconnectWaitDuration property', function(){
                assert.equal(networkStatusView.socketReconnectWaitDuration.asSeconds(), 61);
                assert.match(networkStatusView.$('.network-status-message:last').text(), /Attempting reconnect in 61 seconds/)
            });
            it('should be reset by changing the socketStatus to CONNECTING', function(){

            });
        });
    });
});
