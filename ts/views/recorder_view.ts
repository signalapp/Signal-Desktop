// Copyright 2016-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import moment from 'moment';
import * as log from '../logging/log';

window.Whisper = window.Whisper || {};
const { Whisper } = window;

Whisper.RecorderView = Whisper.View.extend({
  className: 'recorder clearfix',
  template: () => $('#recorder').html(),
  initialize() {
    this.startTime = Date.now();
    this.interval = setInterval(this.updateTime.bind(this), 1000);

    this.onSwitchAwayBound = this.onSwitchAway.bind(this);
    $(window).on('blur', this.onSwitchAwayBound);

    this.handleKeyDownBound = this.handleKeyDown.bind(this);
    this.$el.on('keydown', this.handleKeyDownBound);

    this.start();
  },
  events: {
    'click .close': 'remove',
    'click .finish': 'finish',
    close: 'remove',
  },
  onSwitchAway() {
    this.lostFocus = true;
    this.recorder.finishRecording();
  },
  handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      this.remove();

      event.preventDefault();
      event.stopPropagation();
    }
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
  async remove() {
    // Note: the 'close' event can be triggered by InboxView, when the user clicks
    //   anywhere outside the recording pane.

    if (this.recorder.isRecording()) {
      this.recorder.cancelRecording();
    }

    // Reach in and terminate the web worker used by WebAudioRecorder, otherwise
    // it gets leaked due to a reference cycle with its onmessage listener
    this.recorder.worker.terminate();
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
      await this.context.close();
      log.info('audio context closed');
    }
    this.context = null;

    Whisper.View.prototype.remove.call(this);
    this.trigger('closed');

    $(window).off('blur', this.onSwitchAwayBound);

    this.$el.off('keydown', this.handleKeyDownBound);
  },
  finish() {
    this.clickedFinish = true;
    this.recorder.finishRecording();
  },
  handleBlob(_: unknown, blob: Blob) {
    if (blob && this.clickedFinish) {
      this.trigger('send', blob);
    } else if (blob) {
      this.trigger('confirm', blob, this.lostFocus);
    }
    this.remove();
  },
  async start() {
    this.lostFocus = false;
    this.clickedFinish = false;
    this.context = new AudioContext();
    this.input = this.context.createGain();
    this.recorder = new window.WebAudioRecorder(this.input, {
      encoding: 'mp3',
      workerDir: 'js/', // must end with slash
    });
    this.recorder.onComplete = this.handleBlob.bind(this);
    this.recorder.onError = this.onError.bind(this);
    this.recorder.onTimeout = this.onTimeout.bind(this);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.source = this.context.createMediaStreamSource(stream);
      this.source.connect(this.input);
      this.recorder.startRecording();
    } catch (err) {
      this.onError(err);
    }
  },
  onTimeout() {
    this.recorder.finishRecording();
  },
  onError(error: Error) {
    // Protect against out-of-band errors, which can happen if the user revokes media
    //   permissions after successfully accessing the microphone.
    if (!this.recorder) {
      return;
    }

    this.remove();

    if (error && error.name === 'NotAllowedError') {
      log.warn('RecorderView.onError: Microphone access is not allowed!');
      window.showPermissionsPopup();
    } else {
      log.error(
        'RecorderView.onError:',
        error && error.stack ? error.stack : error
      );
    }
  },
});
