/* global Whisper, extension, Backbone, moment, i18n */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.NetworkStatusView = Whisper.View.extend({
    className: 'network-status',
    templateName: 'networkStatus',
    initialize() {
      this.$el.hide();

      this.renderIntervalHandle = setInterval(this.update.bind(this), 5000);
      extension.windows.onClosed(() => {
        clearInterval(this.renderIntervalHandle);
      });

      setTimeout(this.finishConnectingGracePeriod.bind(this), 5000);

      this.withinConnectingGracePeriod = true;
      this.setSocketReconnectInterval(null);

      window.addEventListener('online', this.update.bind(this));
      window.addEventListener('offline', this.update.bind(this));

      this.model = new Backbone.Model();
      this.listenTo(this.model, 'change', this.onChange);
    },
    onReconnectTimer() {
      this.setSocketReconnectInterval(60000);
    },
    finishConnectingGracePeriod() {
      this.withinConnectingGracePeriod = false;
    },
    setSocketReconnectInterval(millis) {
      this.socketReconnectWaitDuration = moment.duration(millis);
    },
    navigatorOnLine() {
      return navigator.onLine;
    },
    getSocketStatus() {
      return window.getSocketStatus();
    },
    getNetworkStatus() {
      let message = '';
      let instructions = '';
      let hasInterruption = false;
      let action = null;
      let buttonClass = null;

      const socketStatus = this.getSocketStatus();
      switch (socketStatus) {
        case WebSocket.CONNECTING:
          message = i18n('connecting');
          this.setSocketReconnectInterval(null);
          break;
        case WebSocket.OPEN:
          this.setSocketReconnectInterval(null);
          break;
        case WebSocket.CLOSED:
          message = i18n('disconnected');
          instructions = i18n('checkNetworkConnection');
          hasInterruption = true;
          break;
        case WebSocket.CLOSING:
        default:
          message = i18n('disconnected');
          instructions = i18n('checkNetworkConnection');
          hasInterruption = true;
          break;
      }

      if (
        socketStatus === WebSocket.CONNECTING &&
        !this.withinConnectingGracePeriod
      ) {
        hasInterruption = true;
      }
      if (this.socketReconnectWaitDuration.asSeconds() > 0) {
        instructions = i18n('attemptingReconnection', [
          this.socketReconnectWaitDuration.asSeconds(),
        ]);
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
        message,
        instructions,
        hasInterruption,
        action,
        buttonClass,
      };
    },
    update() {
      const status = this.getNetworkStatus();
      this.model.set(status);
    },
    render_attributes() {
      return this.model.attributes;
    },
    onChange() {
      this.render();
      if (this.model.attributes.hasInterruption) {
        this.$el.slideDown();
      } else {
        this.$el.hide();
      }
    },
  });
})();
