import React from 'react';
import classNames from 'classnames';
import moment from 'moment';

import { getTimestamp } from './SessionConversationManager';

import { SessionIconButton, SessionIconSize, SessionIconType } from '../icon';
import {
  SessionButton,
  SessionButtonColor,
  SessionButtonType,
} from '../SessionButton';
import { Constants } from '../../../session';
import { ToastUtils } from '../../../session/utils';
import { DefaultTheme, withTheme } from 'styled-components';
import autoBind from 'auto-bind';

interface Props {
  onExitVoiceNoteView: any;
  onLoadVoiceNoteView: any;
  sendVoiceMessage: any;
  theme: DefaultTheme;
}

interface State {
  recordDuration: number;
  isRecording: boolean;
  isPlaying: boolean;
  isPaused: boolean;

  actionHover: boolean;
  mediaSetting?: boolean;

  // Steam information and data
  mediaBlob?: any;
  audioElement?: HTMLAudioElement;
  streamParams?: {
    stream: any;
    media: any;
    input: any;
    processor: any;
  };

  canvasParams: {
    width: number;
    height: number;
    barRadius: number;
    barWidth: number;
    barPadding: number;
    maxBarHeight: number;
    minBarHeight: number;
  };

  startTimestamp: number;
  nowTimestamp: number;

  updateTimerInterval: NodeJS.Timeout;
}

class SessionRecordingInner extends React.Component<Props, State> {
  private readonly visualisationRef: React.RefObject<HTMLDivElement>;
  private readonly visualisationCanvas: React.RefObject<HTMLCanvasElement>;
  private readonly playbackCanvas: React.RefObject<HTMLCanvasElement>;

  constructor(props: Props) {
    super(props);

    autoBind(this);

    // Refs
    this.visualisationRef = React.createRef();
    this.visualisationCanvas = React.createRef();
    this.playbackCanvas = React.createRef();

    const now = getTimestamp();
    const updateTimerInterval = global.setInterval(this.timerUpdate, 500);

    this.state = {
      recordDuration: 0,
      isRecording: true,
      isPlaying: false,
      isPaused: false,
      actionHover: false,
      mediaSetting: undefined,
      mediaBlob: undefined,
      audioElement: undefined,
      streamParams: undefined,

      startTimestamp: now,
      nowTimestamp: now,
      updateTimerInterval,

      // Initial width of 0 until bounds are located
      canvasParams: {
        width: 0,
        height: 35,
        barRadius: 15,
        barWidth: 4,
        barPadding: 3,
        maxBarHeight: 30,
        minBarHeight: 3,
      },
    };
  }

  public componentWillMount() {
    // This turns on the microphone on the system. Later we need to turn it off.
    this.initiateRecordingStream();
  }

  public componentDidMount() {
    window.addEventListener('resize', this.updateCanvasDimensions);
    this.updateCanvasDimensions();

    // Callback to parent on load complete
    if (this.props.onLoadVoiceNoteView) {
      this.props.onLoadVoiceNoteView();
    }
  }

  public componentWillUnmount() {
    clearInterval(this.state.updateTimerInterval);
    window.removeEventListener('resize', this.updateCanvasDimensions);
  }

  public async componentDidUpdate() {
    const { audioElement, isPlaying } = this.state;

    if (audioElement) {
      if (isPlaying) {
        await audioElement.play();
      } else {
        audioElement.pause();
      }
    }
  }

  // tslint:disable-next-line: cyclomatic-complexity
  public render() {
    const {
      actionHover,
      isPlaying,
      isPaused,
      isRecording,
      startTimestamp,
      nowTimestamp,
      audioElement,
    } = this.state;

    const actionStopRecording = actionHover && isRecording;
    const actionPlayAudio = !isRecording && !isPlaying;
    const actionPauseAudio = !isRecording && !isPaused && isPlaying;
    const actionDefault =
      !actionStopRecording && !actionPlayAudio && !actionPauseAudio;

    const displayTimeMs = isRecording
      ? (nowTimestamp - startTimestamp) * 1000
      : (audioElement && audioElement?.currentTime * 1000) || 0;

    const displayTimeString = moment.utc(displayTimeMs).format('m:ss');

    const actionPauseFn = isPlaying
      ? this.pauseAudio
      : this.stopRecordingStream;

    return (
      <div
        role="main"
        className="session-recording"
        tabIndex={0}
        onKeyDown={this.onKeyDown}
      >
        <div
          className="session-recording--actions"
          onMouseEnter={this.handleHoverActions}
          onMouseLeave={this.handleUnhoverActions}
        >
          {actionStopRecording && (
            <SessionIconButton
              iconType={SessionIconType.Pause}
              iconSize={SessionIconSize.Medium}
              iconColor={Constants.UI.COLORS.DANGER_ALT}
              onClick={actionPauseFn}
              theme={this.props.theme}
            />
          )}
          {actionPauseAudio && (
            <SessionIconButton
              iconType={SessionIconType.Pause}
              iconSize={SessionIconSize.Medium}
              onClick={actionPauseFn}
              theme={this.props.theme}
            />
          )}
          {actionPlayAudio && (
            <SessionIconButton
              iconType={SessionIconType.Play}
              iconSize={SessionIconSize.Medium}
              onClick={this.playAudio}
              theme={this.props.theme}
            />
          )}

          {actionDefault && (
            <SessionIconButton
              iconType={SessionIconType.Microphone}
              iconSize={SessionIconSize.Huge}
              theme={this.props.theme}
            />
          )}
        </div>

        <div
          className="session-recording--visualisation"
          ref={this.visualisationRef}
        >
          {!isRecording && <canvas ref={this.playbackCanvas} />}
          {isRecording && <canvas ref={this.visualisationCanvas} />}
        </div>

        <div
          className={classNames(
            'session-recording--timer',
            !isRecording && 'playback-timer'
          )}
        >
          {displayTimeString}
          {isRecording && <div className="session-recording--timer-light" />}
        </div>

        {!isRecording && (
          <div className="send-message-button">
            <SessionIconButton
              iconType={SessionIconType.Send}
              iconSize={SessionIconSize.Large}
              iconRotation={90}
              onClick={this.onSendVoiceMessage}
              theme={this.props.theme}
            />
          </div>
        )}

        <div className="session-recording--status">
          {isRecording ? (
            <SessionButton
              text={window.i18n('recording')}
              buttonType={SessionButtonType.Brand}
              buttonColor={SessionButtonColor.Primary}
            />
          ) : (
            <SessionButton
              text={window.i18n('delete')}
              buttonType={SessionButtonType.Brand}
              buttonColor={SessionButtonColor.DangerAlt}
              onClick={this.onDeleteVoiceMessage}
            />
          )}
        </div>
      </div>
    );
  }

  private handleHoverActions() {
    if (this.state.isRecording && !this.state.actionHover) {
      this.setState({
        actionHover: true,
      });
    }
  }

  private async timerUpdate() {
    const { nowTimestamp, startTimestamp } = this.state;
    const elapsedTime = nowTimestamp - startTimestamp;

    // Prevent voice messages exceeding max length.
    if (elapsedTime >= Constants.CONVERSATION.MAX_VOICE_MESSAGE_DURATION) {
      await this.stopRecordingStream();
    }

    this.setState({
      nowTimestamp: getTimestamp(),
    });
  }

  private handleUnhoverActions() {
    if (this.state.isRecording && this.state.actionHover) {
      this.setState({
        actionHover: false,
      });
    }
  }

  private stopRecording() {
    this.setState({
      isRecording: false,
      isPaused: true,
    });
  }

  private async playAudio() {
    // Generate audio element if it doesn't exist
    const generateAudioElement = () => {
      const { mediaBlob, recordDuration } = this.state;

      if (!mediaBlob) {
        return undefined;
      }

      const audioURL = window.URL.createObjectURL(mediaBlob.data);
      const audioElementN = new Audio(audioURL);

      audioElementN.loop = false;

      audioElementN.oncanplaythrough = async () => {
        const duration = recordDuration;

        if (duration && audioElementN.currentTime < duration) {
          await audioElementN.play();
        }
      };

      return audioElementN;
    };

    const audioElement = this.state.audioElement || generateAudioElement();
    if (!audioElement) {
      return;
    }

    // Draw sweeping timeline
    const drawSweepingTimeline = () => {
      const { isPaused } = this.state;
      const { textColor } = this.props.theme.colors;
      const { width, height } = this.state.canvasParams;

      const canvas = this.playbackCanvas.current;
      if (!canvas || isPaused) {
        return;
      }

      // Once audioElement is fully buffered, we get the true duration
      let audioDuration = this.state.recordDuration;
      if (audioElement.duration !== Infinity) {
        audioDuration = audioElement.duration;
      }
      const progress = width * (audioElement.currentTime / audioDuration);

      const canvasContext = canvas.getContext('2d');
      if (!canvasContext) {
        return;
      }

      canvasContext.beginPath();
      canvasContext.fillStyle = textColor;
      canvasContext.globalCompositeOperation = 'source-atop';
      canvasContext.fillRect(0, 0, progress, height);

      // Pause audio when it reaches the end of the blob
      if (
        audioElement.duration &&
        audioElement.currentTime === audioElement.duration
      ) {
        this.pauseAudio();
        return;
      }
      requestAnimationFrame(drawSweepingTimeline);
    };

    this.setState({
      audioElement,
      isRecording: false,
      isPaused: false,
      isPlaying: true,
    });

    // If end of audio reached, reset the position of the sweeping timeline
    if (
      audioElement.duration &&
      audioElement.currentTime === audioElement.duration
    ) {
      await this.initPlaybackView();
    }

    await audioElement.play();
    requestAnimationFrame(drawSweepingTimeline);
  }

  private pauseAudio() {
    this.state.audioElement?.pause();

    this.setState({
      isPlaying: false,
      isPaused: true,
    });
  }

  private async onDeleteVoiceMessage() {
    this.pauseAudio();
    await this.stopRecordingStream();
    this.props.onExitVoiceNoteView();
  }

  private onSendVoiceMessage() {
    const audioBlob = this.state.mediaBlob.data;
    if (!audioBlob) {
      return;
    }

    // Is the audio file > attachment filesize limit
    if (audioBlob.size > Constants.CONVERSATION.MAX_ATTACHMENT_FILESIZE_BYTES) {
      ToastUtils.pushFileSizeErrorAsByte(
        Constants.CONVERSATION.MAX_ATTACHMENT_FILESIZE_BYTES
      );
      return;
    }

    this.props.sendVoiceMessage(audioBlob);
  }

  private initiateRecordingStream() {
    navigator.getUserMedia(
      { audio: true },
      this.onRecordingStream,
      this.onStreamError
    );
  }

  private async stopRecordingStream() {
    const { streamParams } = this.state;

    // Exit if parameters aren't yet set
    if (!streamParams) {
      return;
    }

    // Stop the stream
    if (streamParams.media.state !== 'inactive') {
      streamParams.media.stop();
    }

    streamParams.input.disconnect();
    streamParams.processor.disconnect();
    streamParams.stream.getTracks().forEach((track: any) => track.stop);

    // Stop recording
    this.stopRecording();
  }

  private async onRecordingStream(stream: any) {
    // If not recording, stop stream
    if (!this.state.isRecording) {
      await this.stopRecordingStream();
      return;
    }

    // Start recording the stream
    const media = new window.MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus',
    });
    media.ondataavailable = (mediaBlob: any) => {
      this.setState({ mediaBlob }, async () => {
        // Generate PCM waveform for playback
        await this.initPlaybackView();
      });
    };
    media.start();

    // Audio Context
    const audioContext = new window.AudioContext();
    const input = audioContext.createMediaStreamSource(stream);

    const bufferSize = 1024;
    const analyser = audioContext.createAnalyser();
    analyser.smoothingTimeConstant = 0.3;
    analyser.fftSize = 512;

    const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);

    processor.onaudioprocess = () => {
      const streamParams = { stream, media, input, processor };
      this.setState({ streamParams });
      const { textColorSubtleNoOpacity } = this.props.theme.colors;

      const {
        width,
        height,
        barWidth,
        barPadding,
        maxBarHeight,
        minBarHeight,
      } = this.state.canvasParams;

      // Array of volumes by frequency (not in Hz, arbitrary unit)
      const freqTypedArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(freqTypedArray);

      const freqArray = Array.from(freqTypedArray);

      // CANVAS CONTEXT
      const drawRecordingCanvas = () => {
        const canvas = this.visualisationCanvas.current;

        const numBars = width / (barPadding + barWidth);

        let volumeArray = freqArray.map(n => {
          const maxVal = Math.max(...freqArray);
          const initialHeight = maxBarHeight * (n / maxVal);
          const freqBarHeight =
            initialHeight > minBarHeight ? initialHeight : minBarHeight;

          return freqBarHeight;
        });

        // Create initial fake bars to improve appearance.
        // Gradually increasing wave rather than a wall at the beginning
        const frontLoadLen = Math.ceil(volumeArray.length / 10);
        const frontLoad = volumeArray
          .slice(0, frontLoadLen - 1)
          .reverse()
          .map(n => n * 0.8);
        volumeArray = [...frontLoad, ...volumeArray];

        // Chop off values which exceed the bounds of the container
        volumeArray = volumeArray.slice(0, numBars);

        if (canvas) {
          canvas.width = width;
          canvas.height = height;
        }

        const canvasContext = canvas && canvas.getContext('2d');

        for (let i = 0; i < volumeArray.length; i++) {
          const barHeight = Math.ceil(volumeArray[i]);
          const offsetX = Math.ceil(i * (barWidth + barPadding));
          const offsetY = Math.ceil(height / 2 - barHeight / 2);

          if (canvasContext) {
            canvasContext.fillStyle = textColorSubtleNoOpacity;
            this.drawRoundedRect(canvasContext, offsetX, offsetY, barHeight);
          }
        }
      };

      if (this.state.isRecording) {
        requestAnimationFrame(drawRecordingCanvas);
      }
    };

    // Init listeners for visualisation
    input.connect(analyser);
    processor.connect(audioContext.destination);
  }

  private onStreamError(error: any) {
    return error;
  }

  private compactPCM(array: Float32Array, numGroups: number) {
    // Takes an array of arbitary size and compresses it down into a smaller
    // array, by grouping elements into bundles of groupSize and taking their
    // average.
    // Eg. [73, 6, 1, 9, 5, 11, 2, 19, 35] of groupSize 3, becomes
    // = [(73 + 6 + 1) / 3 + (9 + 5 + 11) / 3 + (2 + 19 + 35) / 3]
    // = [27, 8, 19]
    // It's used to get a fixed number of freqBars or volumeBars out of
    // a huge sample array.

    const groupSize = Math.floor(array.length / numGroups);

    let sum = 0;
    const compacted = new Float32Array(numGroups);
    for (let i = 0; i < array.length; i++) {
      sum += array[i];

      if ((i + 1) % groupSize === 0) {
        const compactedIndex = (i + 1) / groupSize;
        const average = sum / groupSize;
        compacted[compactedIndex] = average;
        sum = 0;
      }
    }

    return compacted;
  }

  private async initPlaybackView() {
    const {
      width,
      height,
      barWidth,
      barPadding,
      maxBarHeight,
      minBarHeight,
    } = this.state.canvasParams;

    const { textColorSubtleNoOpacity } = this.props.theme.colors;

    const numBars = width / (barPadding + barWidth);

    // Scan through audio file getting average volume per bar
    // to display amplitude over time as a static image
    const blob = this.state.mediaBlob.data;

    const arrayBuffer = await new Response(blob).arrayBuffer();
    const audioContext = new window.AudioContext();

    await audioContext.decodeAudioData(arrayBuffer, (buffer: AudioBuffer) => {
      this.setState({
        recordDuration: buffer.duration,
      });

      // Get audio amplitude with PCM Data in Float32
      // Grab single channel only to save computation
      const channelData = buffer.getChannelData(0);
      const pcmData = this.compactPCM(channelData, numBars);
      const pcmDataArray = Array.from(pcmData);
      const pcmDataArrayNormalised = pcmDataArray.map(v => Math.abs(v));

      // Prepare values for drawing to canvas
      const maxAmplitude = Math.max(...pcmDataArrayNormalised);

      const barSizeArray = pcmDataArrayNormalised.map(amplitude => {
        let barSize = maxBarHeight * (amplitude / maxAmplitude);

        // Prevent values that are too small
        if (barSize < minBarHeight) {
          barSize = minBarHeight;
        }

        return barSize;
      });

      // CANVAS CONTEXT
      const drawPlaybackCanvas = () => {
        const canvas = this.playbackCanvas.current;
        if (!canvas) {
          return;
        }
        canvas.height = height;
        canvas.width = width;

        const canvasContext = canvas.getContext('2d');
        if (!canvasContext) {
          return;
        }

        for (let i = 0; i < barSizeArray.length; i++) {
          const barHeight = Math.ceil(barSizeArray[i]);
          const offsetX = Math.ceil(i * (barWidth + barPadding));
          const offsetY = Math.ceil(height / 2 - barHeight / 2);

          canvasContext.fillStyle = textColorSubtleNoOpacity;

          this.drawRoundedRect(canvasContext, offsetX, offsetY, barHeight);
        }
      };

      drawPlaybackCanvas();
    });
  }

  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    h: number
  ) {
    let r = this.state.canvasParams.barRadius;
    const w = this.state.canvasParams.barWidth;

    if (w < r * 2) {
      r = w / 2;
    }
    if (h < r * 2) {
      r = h / 2;
    }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  private updateCanvasDimensions() {
    const canvas =
      this.visualisationCanvas.current || this.playbackCanvas.current;
    const width = canvas?.clientWidth || 0;

    this.setState({
      canvasParams: { ...this.state.canvasParams, width },
    });
  }

  private async onKeyDown(event: any) {
    if (event.key === 'Escape') {
      await this.onDeleteVoiceMessage();
    }
  }
}

export const SessionRecording = withTheme(SessionRecordingInner);
