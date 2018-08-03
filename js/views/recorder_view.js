/* global Whisper, moment, WebAudioRecorder */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.RecorderView = Whisper.View.extend({
    className: 'recorder clearfix',
    templateName: 'recorder',
    initialize() {
      this.startTime = Date.now();
      this.interval = setInterval(this.updateTime.bind(this), 1000);
      this.start();
    },
    events: {
      'click .close': 'close',
      'click .finish': 'finish',
      close: 'close',
    },
    updateTime() {
      const duration = moment.duration(Date.now() - this.startTime, 'ms');
      const minutes = `${Math.trunc(duration.asMinutes())}`;
      let seconds = `${duration.seconds()}`;
      if (seconds.length < 2) {
        seconds = `0${seconds}`;
      }
      this.$('.time').text(`${minutes}:${seconds}`);
    },
    close() {
      // Note: the 'close' event can be triggered by InboxView, when the user clicks
      //   anywhere outside the recording pane.

      if (this.recorder.isRecording()) {
        this.recorder.cancelRecording();
      }
      this.recorder = null;

      if (this.interval) {
        clearInterval(this.interval);
      }
      this.interval = null;

      if (this.source) {
        this.source.disconnect();
      }
      this.source = null;

      if (this.context) {
        this.context.close().then(() => {
          window.log.info('audio context closed');
        });
      }
      this.context = null;

      this.remove();
      this.trigger('closed');
    },
    finish() {
      this.recorder.finishRecording();
      this.close();
    },
    handleBlob(recorder, blob) {
      if (blob) {
        this.trigger('send', blob);
      }
    },
    start() {
      this.context = new AudioContext();
      this.input = this.context.createGain();
      this.recorder = new WebAudioRecorder(this.input, {
        encoding: 'mp3',
        workerDir: 'js/', // must end with slash
      });
      this.recorder.onComplete = this.handleBlob.bind(this);
      this.recorder.onError = this.onError;
      navigator.webkitGetUserMedia(
        { audio: true },
        stream => {
          this.source = this.context.createMediaStreamSource(stream);
          this.source.connect(this.input);
        },
        this.onError.bind(this)
      );
      this.recorder.startRecording();
    },
    onError(error) {
      // Protect against out-of-band errors, which can happen if the user revokes media
      //   permissions after successfully accessing the microphone.
      if (!this.recorder) {
        return;
      }

      this.close();

      if (error && error.name === 'PermissionDeniedError') {
        window.log.warn(
          'RecorderView.onError: Microphone access is not allowed!'
        );
        window.showPermissionsPopup();
      } else {
        window.log.error(
          'RecorderView.onError:',
          error && error.stack ? error.stack : error
        );
      }
    },
  });
})();
