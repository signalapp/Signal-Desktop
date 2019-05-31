/* global Backbone: false */
/* global i18n: false */
/* global React: false */
/* global ReactDOM: false */

// eslint-disable-next-line func-names
(function() {
  'use strict';

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
    update(props, cb) {
      const updatedProps = this.augmentProps(props);
      const reactElement = this.JSX
        ? this.JSX
        : React.createElement(this.Component, updatedProps);
      ReactDOM.render(reactElement, this.el, () => {
        if (cb) {
          try {
            cb();
          } catch (error) {
            window.log.error(
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
      return Object.assign({}, props, {
        close: () => {
          this.remove();
        },
        i18n,
      });
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
