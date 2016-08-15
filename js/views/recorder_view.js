/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.RecorderView = Whisper.View.extend({
        className: 'recorder clearfix',
        templateName: 'recorder',
        initialize: function() {
          this.startTime = Date.now();
          this.interval = setInterval(this.updateTime.bind(this), 1000);
          this.start();
        },
        events: {
            'click .close': 'close',
            'click .finish': 'finish',
            'close': 'close'
        },
        updateTime: function() {
          var duration = moment.duration(Date.now() - this.startTime, 'ms');
          var minutes = '' + Math.trunc(duration.asMinutes());
          var seconds = '' + duration.seconds();
          if (seconds.length < 2) {
            seconds = '0' + seconds;
          }
          this.$('.time').text(minutes + ':' + seconds);
        },
        close: function() {
            if (this.recorder.isRecording()) {
                this.recorder.cancelRecording();
            }
            if (this.interval) {
              clearInterval(this.interval);
            }
            this.source.disconnect();
            if (this.context) {
              this.context.close().then(function() {
                  console.log('audio context closed');
              });
            }
            this.remove();
            this.trigger('closed');
        },
        finish: function() {
            this.recorder.finishRecording();
            this.close();
        },
        handleBlob: function(recorder, blob) {
            if (blob) {
              this.trigger('send', blob);
            }
        },
        start: function() {
            this.context = new AudioContext();
            this.input = this.context.createGain();
            this.recorder = new WebAudioRecorder(this.input, {
                encoding: 'mp3',
                workerDir: 'js/'     // must end with slash
            });
            this.recorder.onComplete = this.handleBlob.bind(this);
            this.recorder.onError = this.onError;
            navigator.webkitGetUserMedia({ audio: true }, function(stream) {
                this.source = this.context.createMediaStreamSource(stream);
                this.source.connect(this.input);
            }.bind(this), this.onError);
            this.recorder.startRecording();
        },
        onError: function(error) {
            console.log(error);
        }
    });
})();
