(function () {
    'use strict';

    window.Whisper = window.Whisper || {};

    Whisper.NetworkStatusView = Whisper.View.extend({
        className: 'network-status',
        initialize: function() {
            this.$el.hide();

            var renderIntervalHandle = setInterval(this.render.bind(this), 5000);
            extension.windows.onClosed(function () { clearInterval(renderIntervalHandle); });

            setTimeout(this.finishConnectingGracePeriod.bind(this), 5000);

            this.withinConnectingGracePeriod = true;
            this.setSocketReconnectInterval(null);

            window.addEventListener('online', this.render.bind(this));
            window.addEventListener('offline', this.render.bind(this));
        },
        finishConnectingGracePeriod: function() {
            this.withinConnectingGracePeriod = false;
        },
        setSocketReconnectInterval: function(millis) {
            this.socketReconnectWaitDuration = moment.duration(millis);
        },
        navigatorOnLine: function() { return navigator.onLine; },
        getSocketStatus: function() { return window.getSocketStatus(); },
        getNetworkStatus: function() {

            var message = '';
            var instructions = '';
            var hasInterruption = false;

            var socketStatus = this.getSocketStatus();
            switch(socketStatus) {
                case WebSocket.CONNECTING:
                    message = i18n('connecting');
                    this.setSocketReconnectInterval(null);
                    break;
                case WebSocket.OPEN:
                    this.setSocketReconnectInterval(null);
                    break;
                case WebSocket.CLOSING:
                    message = i18n('disconnected');
                    instructions = i18n('checkNetworkConnection');
                    hasInterruption = true;
                break;
                case WebSocket.CLOSED:
                    message = i18n('disconnected');
                    instructions = i18n('checkNetworkConnection');
                    hasInterruption = true;
                break;
            }

            if (socketStatus == WebSocket.CONNECTING && !this.withinConnectingGracePeriod) {
                hasInterruption = true;
            }
            if (this.socketReconnectWaitDuration.asSeconds() > 0) {
                instructions = i18n('attemptingReconnection', [this.socketReconnectWaitDuration.asSeconds()]);
            }
            if (!this.navigatorOnLine()) {
                hasInterruption = true;
                message = i18n('offline');
                instructions = i18n('checkNetworkConnection');
            }

            return {
                message: message,
                instructions: instructions,
                hasInterruption: hasInterruption
            };
        },
        render: function() {
            var status = this.getNetworkStatus();

            if (status.hasInterruption) {
                this.$el.slideDown();
            }
            else {
                this.$el.hide();
            }
            var template = Whisper.View.Templates['networkStatus'];
            this.$el.html(Mustache.render(template, status, Whisper.View.Templates));
            return this;
        }
    });



})();
