importScripts("Mp3LameEncoder.min.js");

var NUM_CH = 2, // constant
    sampleRate = 44100,
    options = undefined,
    maxBuffers = undefined,
    encoder = undefined,
    recBuffers = undefined,
    bufferCount = 0;

function error(message) {
  self.postMessage({ command: "error", message: "mp3: " + message });
}

function init(data) {
  if (data.config.numChannels === NUM_CH) {
    sampleRate = data.config.sampleRate;
    options = data.options;
  } else
    error("numChannels must be " + NUM_CH);
};

function setOptions(opt) {
  if (encoder || recBuffers)
    error("cannot set options during recording");
  else
    options = opt;
}

function start(bufferSize) {
  maxBuffers = Math.ceil(options.timeLimit * sampleRate / bufferSize);
  if (options.encodeAfterRecord)
    recBuffers = [];
  else
    encoder = new Mp3LameEncoder(sampleRate, options.mp3.bitRate);
}

function record(buffer) {
  if (bufferCount++ < maxBuffers)
    if (encoder)
      encoder.encode(buffer);
    else
      recBuffers.push(buffer);
  else
    self.postMessage({ command: "timeout" });
};

function postProgress(progress) {
  self.postMessage({ command: "progress", progress: progress });
};

function finish() {
  if (recBuffers) {
    postProgress(0);
    encoder = new Mp3LameEncoder(sampleRate, options.mp3.bitRate);
    var timeout = Date.now() + options.progressInterval;
    while (recBuffers.length > 0) {
      encoder.encode(recBuffers.shift());
      var now = Date.now();
      if (now > timeout) {
        postProgress((bufferCount - recBuffers.length) / bufferCount);
        timeout = now + options.progressInterval;
      }
    }
    postProgress(1);
  }
  self.postMessage({
    command: "complete",
    blob: encoder.finish(options.mp3.mimeType)
  });
  cleanup();
};

function cleanup() {
  encoder = recBuffers = undefined;
  bufferCount = 0;
}

self.onmessage = function(event) {
  var data = event.data;
  switch (data.command) {
    case "init":    init(data);                 break;
    case "options": setOptions(data.options);   break;
    case "start":   start(data.bufferSize);     break;
    case "record":  record(data.buffer);        break;
    case "finish":  finish();                   break;
    case "cancel":  cleanup();
  }
};

self.postMessage({ command: "loaded" });
