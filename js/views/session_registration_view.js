/* eslint-disable no-plusplus */
/* global
 Whisper,
*/

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.SessionRegistrationView = Whisper.View.extend({
    className: 'session-fullscreen',
    initialize() {
      this.render();
    },
    render() {
      this.session_registration_view = new Whisper.ReactWrapperView({
        className: 'session-full-screen-flow session-fullscreen',
        Component: window.Signal.Components.SessionRegistrationView,
        props: {},
      });

      this.$el.append(this.session_registration_view.el);
      return this;
    },

    log(s) {
      window.log.info(s);
      this.$('#status').text(s);
    },
    displayError(error) {
      this.$('#error')
        .hide()
        .text(error)
        .addClass('in')
        .fadeIn();
    },

    showToast(message) {
      const toast = new Whisper.MessageToastView({
        message,
      });
      toast.$el.appendTo(this.$el);
      toast.render();
    },
  });

  class TextScramble {
    constructor(el) {
      this.el = el;
      this.chars = '0123456789abcdef';
      this.update = this.update.bind(this);
    }

    setText(newText) {
      const oldText = this.el.value;
      const length = Math.max(oldText.length, newText.length);
      // eslint-disable-next-line no-return-assign
      const promise = new Promise(resolve => (this.resolve = resolve));
      this.queue = [];

      for (let i = 0; i < length; i++) {
        const from = oldText[i] || '';
        const to = newText[i] || '';
        const start = Math.floor(Math.random() * 40);
        const end = start + Math.floor(Math.random() * 40);
        this.queue.push({
          from,
          to,
          start,
          end,
        });
      }

      cancelAnimationFrame(this.frameRequest);
      this.frame = 0;
      this.update();
      return promise;
    }

    update() {
      let output = '';
      let complete = 0;

      for (let i = 0, n = this.queue.length; i < n; i++) {
        const { from, to, start, end } = this.queue[i];
        let { char } = this.queue[i];

        if (this.frame >= end) {
          complete++;
          output += to;
        } else if (this.frame >= start) {
          if (!char || Math.random() < 0.28) {
            char = this.randomChar();
            this.queue[i].char = char;
          }
          output += char;
        } else {
          output += from;
        }
      }

      this.el.value = output;

      if (complete === this.queue.length) {
        this.resolve();
      } else {
        this.frameRequest = requestAnimationFrame(this.update);
        this.frame++;
      }
    }

    randomChar() {
      return this.chars[Math.floor(Math.random() * this.chars.length)];
    }
  }
  window.Session = window.Session || {};

  window.Session.setNewSessionID = sessionID => {
    const el = document.querySelector('.session-id-editable-textarea');
    const fx = new TextScramble(el);
    el.value = sessionID;
    fx.setText(sessionID);
  };
})();
