(function(window) {
  // internal: same as jQuery.extend(true, args...)
  var extend = function() {
    var target = arguments[0],
        sources = [].slice.call(arguments, 1);
    for (var i = 0; i < sources.length; ++i) {
      var src = sources[i];
      for (key in src) {
        var val = src[key];
        target[key] = typeof val === "object"
          ? extend(typeof target[key] === "object" ? target[key] : {}, val)
          : val;
      }
    }
    return target;
  };

  var WORKER_FILE = {
    wav: "WebAudioRecorderWav.js",
    ogg: "WebAudioRecorderOgg.js",
    mp3: "WebAudioRecorderMp3.js"
  };

  // default configs
  var CONFIGS = {
    workerDir: "/",     // worker scripts dir (end with /)
    numChannels: 2,     // number of channels
    encoding: "wav",    // encoding (can be changed at runtime)

    // runtime options
    options: {
      timeLimit: 300,           // recording time limit (sec)
      encodeAfterRecord: false, // process encoding after recording
      progressInterval: 1000,   // encoding progress report interval (millisec)
      bufferSize: undefined,    // buffer size (use browser default)

      // encoding-specific options
      wav: {
        mimeType: "audio/wav"
      },
      ogg: {
        mimeType: "audio/ogg",
        quality: 0.5            // (VBR only): quality = [-0.1 .. 1]
      },
      mp3: {
        mimeType: "audio/mpeg",
        bitRate: 160            // (CBR only): bit rate = [64 .. 320]
      }
    }
  };

  // constructor
  var WebAudioRecorder = function(sourceNode, configs) {
    extend(this, CONFIGS, configs || {});
    this.context = sourceNode.context;
    if (this.context.createScriptProcessor == null)
      this.context.createScriptProcessor = this.context.createJavaScriptNode;
    this.input = this.context.createGain();
    sourceNode.connect(this.input);
    this.buffer = [];
    this.initWorker();
  };

  // instance methods
  extend(WebAudioRecorder.prototype, {
    isRecording: function() { return this.processor != null; },

    setEncoding: function(encoding) {
      if (this.isRecording())
        this.error("setEncoding: cannot set encoding during recording");
      else if (this.encoding !== encoding) {
        this.encoding = encoding;
        this.initWorker();
      }
    },

    setOptions: function(options) {
      if (this.isRecording())
        this.error("setOptions: cannot set options during recording");
      else {
        extend(this.options, options);
        this.worker.postMessage({ command: "options", options: this.options });
      }
    },

    startRecording: function() {
      if (this.isRecording())
        this.error("startRecording: previous recording is running");
      else {
        var numChannels = this.numChannels,
            buffer = this.buffer,
            worker = this.worker;
        this.processor = this.context.createScriptProcessor(
                                this.options.bufferSize,
                                this.numChannels, this.numChannels);
        this.input.connect(this.processor);
        this.processor.connect(this.context.destination);
        this.processor.onaudioprocess = function(event) {
          for (var ch = 0; ch < numChannels; ++ch)
            buffer[ch] = event.inputBuffer.getChannelData(ch);
          worker.postMessage({ command: "record", buffer: buffer });
        };
        this.worker.postMessage({
          command: "start",
          bufferSize: this.processor.bufferSize
        });
        this.startTime = Date.now();
      }
    },

    recordingTime: function() {
      return this.isRecording() ? (Date.now() - this.startTime) * 0.001 : null;
    },

    cancelRecording: function() {
      if (this.isRecording()) {
        this.input.disconnect();
        this.processor.disconnect();
        delete this.processor;
        this.worker.postMessage({ command: "cancel" });
      } else
        this.error("cancelRecording: no recording is running");
    },

    finishRecording: function() {
      if (this.isRecording()) {
        this.input.disconnect();
        this.processor.disconnect();
        delete this.processor;
        this.worker.postMessage({ command: "finish" });
      } else
        this.error("finishRecording: no recording is running");
    },

    cancelEncoding: function() {
      if (this.options.encodeAfterRecord)
        if (this.isRecording())
          this.error("cancelEncoding: recording is not finished");
        else {
          this.onEncodingCanceled(this);
          this.initWorker();
        }
      else
        this.error("cancelEncoding: invalid method call");
    },

    initWorker: function() {
      if (this.worker != null)
        this.worker.terminate();
      this.onEncoderLoading(this, this.encoding);
      this.worker = new Worker(this.workerDir + WORKER_FILE[this.encoding]);
      var _this = this;
      this.worker.onmessage = function(event) {
        var data = event.data;
        switch (data.command) {
          case "loaded":
            _this.onEncoderLoaded(_this, _this.encoding);
            break;
          case "timeout":
            _this.onTimeout(_this);
            break;
          case "progress":
            _this.onEncodingProgress(_this, data.progress);
            break;
          case "complete":
            _this.onComplete(_this, data.blob);
            break;
          case "error":
            _this.error(data.message);
        }
      };
      this.worker.postMessage({
        command: "init",
        config: {
          sampleRate: this.context.sampleRate,
          numChannels: this.numChannels
        },
        options: this.options
      });
    },

    error: function(message) {
      this.onError(this, "WebAudioRecorder.js:" + message);
    },

    // event handlers
    onEncoderLoading: function(recorder, encoding) {},
    onEncoderLoaded: function(recorder, encoding) {},
    onTimeout: function(recorder) { recorder.finishRecording(); },
    onEncodingProgress: function (recorder, progress) {},
    onEncodingCanceled: function(recorder) {},
    onComplete: function(recorder, blob) {
      recorder.onError(recorder, "WebAudioRecorder.js: You must override .onComplete event");
    },
    onError: function(recorder, message) { console.log(message); }
  });

  window.WebAudioRecorder = WebAudioRecorder;
})(window);
