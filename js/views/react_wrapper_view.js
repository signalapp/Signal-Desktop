/* global Backbone: false */

// Additional globals used:
//   window.React
//   window.ReactDOM
//   window.i18n

// eslint-disable-next-line func-names
(function () {
  'use strict';

  window.Whisper = window.Whisper || {};

  window.Whisper.ReactWrapperView = Backbone.View.extend({
    className: 'react-wrapper',
    initialize(options) {
      const { Component, props, onClose } = options;
      this.render();

      this.Component = Component;
      this.onClose = onClose;

      this.update(props);
    },
    update(props) {
      const updatedProps = this.augmentProps(props);
      const element = window.React.createElement(this.Component, updatedProps);
      window.ReactDOM.render(element, this.el);
    },
    augmentProps(props) {
      return Object.assign({}, props, {
        close: () => {
          if (this.onClose) {
            this.onClose();
            return;
          }
          this.remove();
        },
        i18n: window.i18n,
      });
    },
    remove() {
      window.ReactDOM.unmountComponentAtNode(this.el);
      Backbone.View.prototype.remove.call(this);
    },
  });
}());
