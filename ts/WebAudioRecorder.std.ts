// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const DEFAULT_OPTIONS = {
  bufferSize: undefined, // buffer size (use browser default)
  encodeAfterRecord: false,
  mp3: {
    mimeType: 'audio/mpeg',
    bitRate: 160, // (CBR only): bit rate = [64 .. 320]
  },
  numChannels: 2, // number of channels
  progressInterval: 1000, // encoding progress report interval (millisec)
  timeLimit: 300, // recording time limit (sec)
};

type OptionsType = {
  bufferSize: number | undefined;
  numChannels: number;
  timeLimit?: number;
};

export class WebAudioRecorder {
  #buffer: Array<Float32Array>;
  #options: OptionsType;
  #context: BaseAudioContext;
  #input: GainNode;
  #onComplete: (recorder: WebAudioRecorder, blob: Blob) => unknown;
  #onError: (recorder: WebAudioRecorder, error: string) => unknown;
  private processor?: ScriptProcessorNode;
  public worker?: Worker;

  constructor(
    sourceNode: GainNode,
    options: Pick<OptionsType, 'timeLimit'>,
    callbacks: {
      onComplete: (recorder: WebAudioRecorder, blob: Blob) => unknown;
      onError: (recorder: WebAudioRecorder, error: string) => unknown;
    }
  ) {
    this.#options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };

    this.#context = sourceNode.context;
    this.#input = this.#context.createGain();
    sourceNode.connect(this.#input);
    this.#buffer = [];
    this.#initWorker();

    this.#onComplete = callbacks.onComplete;
    this.#onError = callbacks.onError;
  }

  isRecording(): boolean {
    return this.processor != null;
  }

  startRecording(): void {
    if (this.isRecording()) {
      this.error('startRecording: previous recording is running');
      return;
    }

    const { worker } = this;
    const buffer = this.#buffer;
    const { bufferSize, numChannels } = this.#options;

    if (!worker) {
      this.error('startRecording: worker not initialized');
      return;
    }

    this.processor = this.#context.createScriptProcessor(
      bufferSize,
      numChannels,
      numChannels
    );
    this.#input.connect(this.processor);
    this.processor.connect(this.#context.destination);
    this.processor.onaudioprocess = event => {
      // eslint-disable-next-line no-plusplus
      for (let ch = 0; ch < numChannels; ++ch) {
        buffer[ch] = event.inputBuffer.getChannelData(ch);
      }
      worker.postMessage({ command: 'record', buffer });
    };
    worker.postMessage({
      command: 'start',
      bufferSize: this.processor.bufferSize,
    });
  }

  cancelRecording(): void {
    if (!this.isRecording()) {
      this.error('cancelRecording: no recording is running');
      return;
    }

    if (!this.worker || !this.processor) {
      this.error('startRecording: worker not initialized');
      return;
    }

    this.#input.disconnect();
    this.processor.disconnect();
    delete this.processor;
    this.worker.postMessage({ command: 'cancel' });
  }

  finishRecording(): void {
    if (!this.isRecording()) {
      this.error('finishRecording: no recording is running');
      return;
    }

    if (!this.worker || !this.processor) {
      this.error('startRecording: worker not initialized');
      return;
    }

    this.#input.disconnect();
    this.processor.disconnect();
    delete this.processor;
    this.worker.postMessage({ command: 'finish' });
  }

  #initWorker(): void {
    if (this.worker != null) {
      this.worker.terminate();
    }

    this.worker = new Worker('js/WebAudioRecorderMp3.js');
    this.worker.onmessage = event => {
      const { data } = event;
      switch (data.command) {
        case 'complete':
          this.#onComplete(this, data.blob);
          break;
        case 'error':
          this.error(data.message);
          break;
        default:
          break;
      }
    };
    this.worker.postMessage({
      command: 'init',
      config: {
        sampleRate: this.#context.sampleRate,
        numChannels: this.#options.numChannels,
      },
      options: this.#options,
    });
  }

  error(message: string): void {
    this.#onError(this, `WebAudioRecorder.js: ${message}`);
  }
}
