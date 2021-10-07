// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global Backbone: false */
/* global i18n: false */
/* global React: false */
/* global ReactDOM: false */

// eslint-disable-next-line func-names
(function () {
  window.Whisper = window.Whisper || {};

  window.Whisper.ReactWrapperView = Backbone.View.extend({
    className: 'react-wrapper',
    initialize(options) {
      const {
        Component,
        JSX,
        props,
        onClose,
        tagName,
        className,
        onInitialRender,
        elCallback,
      } = options;
      this.render();
      if (elCallback) {
        elCallback(this.el);
      }

      this.tagName = tagName;
      this.className = className;
      this.JSX = JSX;
      this.Component = Component;
      this.onClose = onClose;
      this.onInitialRender = onInitialRender;

      this.update(props);

      this.hasRendered = false;
    },
    update(propsOrJSX, cb) {
      const reactElement = this.JSX
        ? propsOrJSX || this.JSX
        : React.createElement(this.Component, this.augmentProps(propsOrJSX));

      ReactDOM.render(reactElement, this.el, () => {
        if (cb) {
          try {
            cb();
          } catch (error) {
            window.SignalContext.log.error(
              'ReactWrapperView.update error:',
              error && error.stack ? error.stack : error
            );
          }
        }

        if (this.hasRendered) {
          return;
        }

        this.hasRendered = true;
        if (this.onInitialRender) {
          this.onInitialRender();
        }
      });
    },
    augmentProps(props) {
      return {
        ...props,
        close: () => {
          this.remove();
        },
        i18n,
      };
    },
    remove() {
      if (this.onClose) {
        this.onClose();
      }
      ReactDOM.unmountComponentAtNode(this.el);
      Backbone.View.prototype.remove.call(this);
    },
  });
})();
