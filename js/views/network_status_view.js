(function () {
    'use strict';

    window.Whisper = window.Whisper || {};

    Whisper.NetworkStatusView = Whisper.View.extend({
        className: 'network-status',
        templateName: 'networkStatus',
        initialize: function() {
            this.$el.hide();

            var renderIntervalHandle = setInterval(this.update.bind(this), 5000);
            extension.windows.onClosed(function () { clearInterval(renderIntervalHandle); });

            setTimeout(this.finishConnectingGracePeriod.bind(this), 5000);

            this.withinConnectingGracePeriod = true;
            this.setSocketReconnectInterval(null);

            window.addEventListener('online', this.update.bind(this));
            window.addEventListener('offline', this.update.bind(this));

            this.model = new Backbone.Model();
            this.listenTo(this.model, 'change', this.onChange);
        },
        events: {
            'click .openInstaller': extension.install
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
                buttonClass: buttonClass
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
