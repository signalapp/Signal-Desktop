(function () {
    'use strict';

    window.Whisper = window.Whisper || {};

    Whisper.NetworkStatusView = Whisper.View.extend({
        className: 'network-status',
        templateName: 'networkStatus',
        initialize: function() {
            this.$el.hide();

            this.renderIntervalHandle = setInterval(this.update.bind(this), 5000);
            extension.windows.onClosed(function () {
                clearInterval(this.renderIntervalHandle);
            }.bind(this));

            setTimeout(this.finishConnectingGracePeriod.bind(this), 5000);

            this.withinConnectingGracePeriod = true;
            this.setSocketReconnectInterval(null);

            window.addEventListener('online', this.update.bind(this));
            window.addEventListener('offline', this.update.bind(this));

            this.model = new Backbone.Model();
            this.listenTo(this.model, 'change', this.onChange);
        },
        onReconnectTimer: function() {
          this.setSocketReconnectInterval(60000);
        },
        finishConnectingGracePeriod: function() {
            this.withinConnectingGracePeriod = false;
        },
        setSocketReconnectInterval: function(millis) {
            this.socketReconnectWaitDuration = moment.duration(millis);
        },
        setOffline: function() {
            if (!this.offlineStart) {
                this.offlineStart = Date.now();
            }
        },
        setOnline: function() {
            this.offlineStart = null;
        },
        timeSinceOffline: function() {
            if (!this.offlineStart) {
                return 0;
            }

            var now = Date.now();
            var delta = now - this.offlineStart;

            return delta;
        },
        navigatorOnLine: function() { return navigator.onLine; },
        getSocketStatus: function() { return window.getSocketStatus(); },
        getNetworkStatus: function() {

            var message = '';
            var instructions = '';
            var hasInterruption = false;
            var action = null;
            var buttonClass = null;

            var socketStatus = this.getSocketStatus();
            switch(socketStatus) {
                case WebSocket.CONNECTING:
                    message = i18n('connecting');
                    this.setSocketReconnectInterval(null);
                    break;
                case WebSocket.OPEN:
                    this.setOnline();
                    this.setSocketReconnectInterval(null);
                    break;
                case WebSocket.CLOSING:
                    this.setOffline();
                    message = i18n('disconnected');
                    instructions = i18n('checkNetworkConnection');
                    hasInterruption = true;
                break;
                case WebSocket.CLOSED:
                    this.setOffline();
                    message = i18n('disconnected');
                    instructions = i18n('checkNetworkConnection');
                    hasInterruption = true;
                break;
                default:
                    this.setOffline();
                break;
            }

            // On a websocket-only interruption (the overall network connection is still
            //   there), we delay a bit before showing 'Disconnected' as our status. Thus,
            //   the user would never see an immediate reconnect.
            if (this.timeSinceOffline() < 5000) {
                hasInterruption = false;
            } else if (socketStatus == WebSocket.CONNECTING && !this.withinConnectingGracePeriod) {
                hasInterruption = true;
            }
            if (this.socketReconnectWaitDuration.asSeconds() > 0) {
                instructions = i18n('attemptingReconnection', [this.socketReconnectWaitDuration.asSeconds()]);
            }
            if (!this.navigatorOnLine()) {
                hasInterruption = true;
                message = i18n('offline');
                instructions = i18n('checkNetworkConnection');
            } else if (!Whisper.Registration.isDone()) {
                hasInterruption = true;
                message = i18n('Unlinked');
                instructions = i18n('unlinkedWarning');
                action = i18n('relink');
                buttonClass = 'openInstaller';
            }

            return {
                message: message,
                instructions: instructions,
                hasInterruption: hasInterruption,
                action: action,
                buttonClass: buttonClass,
            };
        },
        update: function() {
            var status = this.getNetworkStatus();
            this.model.set(status);
        },
        render_attributes: function() {
            return this.model.attributes;
        },
        onChange: function() {
            this.render();
            if (this.model.attributes.hasInterruption) {
                this.$el.slideDown();
            }
            else {
                this.$el.hide();
            }
        }
    });



})();
