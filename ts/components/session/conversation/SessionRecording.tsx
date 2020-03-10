import React from 'react';
import moment from 'moment';

import {  SessionIconButton, SessionIconSize, SessionIconType } from '../icon';
import { SessionButton, SessionButtonType, SessionButtonColor } from '../SessionButton';
import { Timestamp } from '../../conversation/Timestamp';


interface Props {
  onStoppedRecording: any;
  onStartedRecording: any;
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
  streamParams?:  {
    stream: any;
    media: any;
    input: any; 
    processor: any;
  }

  volumeArray?: Array<number>;

  startTimestamp: number;
  nowTimestamp: number;
  
  updateTimerInterval: NodeJS.Timeout;
}

export class SessionRecording extends React.Component<Props, State> {
  private visualisationRef: React.RefObject<HTMLDivElement>;
  private visualisationCanvas: React.RefObject<HTMLCanvasElement>;
  private playbackCanvas: React.RefObject<HTMLCanvasElement>;

  constructor(props: any) {
    super(props);

    this.handleHoverActions = this.handleHoverActions.bind(this);
    this.handleUnhoverActions = this.handleUnhoverActions.bind(this);
    
    this.playAudio = this.playAudio.bind(this);
    this.pauseAudio = this.pauseAudio.bind(this);
    this.stopRecording = this.stopRecording.bind(this);

    this.onSendVoiceMessage = this.onSendVoiceMessage.bind(this);
    this.onDeleteVoiceMessage = this.onDeleteVoiceMessage.bind(this);

    this.timerUpdate = this.timerUpdate.bind(this);
    this.onRecordingStream = this.onRecordingStream.bind(this);
    this.stopRecordingStream = this.stopRecordingStream.bind(this);

    this.visualisationRef = React.createRef();
    this.visualisationCanvas = React.createRef();
    this.playbackCanvas = React.createRef();

    this.onKeyDown = this.onKeyDown.bind(this);

    const now = Number(moment().format('x')) / 1000;
    const updateTimerInterval = setInterval(this.timerUpdate, 1000);
    
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
      volumeArray: undefined,
      
      startTimestamp: now,
      nowTimestamp: now,
      updateTimerInterval,
    };
    
  }

  public async componentWillMount(){
    // This turns on the microphone on the system. Later we need to turn it off.
    this.initiateRecordingStream();
  }

  public componentWillUnmount(){
    clearInterval(this.state.updateTimerInterval);
  }

  public componentDidUpdate() {
    const { audioElement, isPlaying } = this.state;
    
    if (audioElement){
      if (isPlaying) {
        audioElement.play();
      } else {
        audioElement.pause();
      }
    }
  }


  render() {
    const {
      actionHover,
      isPlaying,
      isPaused,
      isRecording,
      startTimestamp,
      nowTimestamp,
    } = this.state;

    const actionStopRecording = actionHover && isRecording;
    const actionPlayAudio = !isRecording && !isPlaying;
    const actionPauseAudio = !isRecording && !isPaused && isPlaying;
    const actionDefault = !actionStopRecording && !actionPlayAudio && !actionPauseAudio;
    
    const elapsedTimeMs = 1000 * (nowTimestamp - startTimestamp);
    const displayTimeString = moment.utc(elapsedTimeMs).format('m:ss');

    const actionPauseFn = isPlaying ? this.pauseAudio : this.stopRecordingStream;


    return (
      <div
        className="session-recording"
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
                // FIXME VINCE: Globalise constants for JS Session Colors
                iconColor={'#FF4538'}
                onClick={actionPauseFn}
              />
            )}
            {actionPauseAudio && (
              <SessionIconButton
                iconType={SessionIconType.Pause}
                iconSize={SessionIconSize.Medium}
                // FIXME VINCE: Globalise constants for JS Session Colors
                iconColor={'#FFFFFF'}
                onClick={actionPauseFn}
              />
            )}
            {actionPlayAudio && (
              <SessionIconButton
                iconType={SessionIconType.Play}
                iconSize={SessionIconSize.Medium}
                onClick={this.playAudio}
              />
            )}
            
            {actionDefault && (
              <SessionIconButton
                iconType={SessionIconType.Microphone}
                iconSize={SessionIconSize.Huge}
              />
            )}
        </div>

        <div
         className="session-recording--visualisation"
         ref={this.visualisationRef}
        >
          {!isRecording && <canvas ref={this.playbackCanvas}></canvas>}
          {isRecording && <canvas ref={this.visualisationCanvas}></canvas>}
        </div>
        

        { isRecording ? (
            <div className="session-recording--timer">
              { displayTimeString }
              <div className="session-recording--timer-light">

              </div>
            </div>
          ) : (
            <div className="send-message-button">
              <SessionIconButton
                iconType={SessionIconType.Send}
                iconSize={SessionIconSize.Large}
                iconColor={'#FFFFFF'}
                iconRotation={90}
                onClick={this.onSendVoiceMessage}
              />
            </div>
          )}

        <div className="session-recording--status">
          { isRecording ? (
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
    if ((this.state.isRecording) && !this.state.actionHover) {
        this.setState({
            actionHover: true,
        });
    }
  }

  private timerUpdate(){
    const { nowTimestamp, startTimestamp, isRecording } = this.state;
    const elapsedTime = (nowTimestamp - startTimestamp);

    if (!isRecording || elapsedTime >= window.CONSTANTS.MAX_VOICE_MESSAGE_DURATION){
      clearInterval(this.state.updateTimerInterval);
      this.stopRecordingStream();
    }

    this.setState({
      nowTimestamp: Number(moment().format('x')) / 1000
    });
  }

  private handleUnhoverActions() {
    if (this.state.isRecording && this.state.actionHover) {
        this.setState({
            actionHover: false,
        });
    }
  }

  private async stopRecording() {

    this.setState({
        isRecording: false,
        isPaused: true,
    });
  }

  private playAudio() {
    // Generate audio element if it doesn't exist
    const generateAudioElement = () => {
      const { mediaBlob, recordDuration } = this.state;
  
      if (!mediaBlob){
        return undefined;
      }
  
      const audioURL = window.URL.createObjectURL(mediaBlob.data);
      const audioElement = new Audio(audioURL);

      audioElement.loop = false;

      audioElement.oncanplaythrough = () => {
        const duration = recordDuration;
        const progress = recordDuration - audioElement.currentTime;

        if (duration && audioElement.currentTime < duration) {
          audioElement.play();
        }
        
      };

      

      return audioElement;
    }

    const audioElement = this.state.audioElement || generateAudioElement();
    
    // Start playing recording
    // FIXME VINCE: Prevent looping of playing
    audioElement.play();

    // Draw canvas
    this.onPlaybackStream();


    this.setState({
      audioElement,
      isRecording: false,
      isPaused: false,
      isPlaying: true,
    });

  }
  
  private pauseAudio() {
    this.state.audioElement?.pause();

    // STOP ANIMAION FRAME
    // cancelAnimationFrame(playbackAnimationID);

    this.setState({
      isPlaying: false,
      isPaused: true,
    });
  }

  private initSendVoiceRecording(){
    // Is the audio file < 10mb? That's the attachment filesize limit

    return;
  }

  private onDeleteVoiceMessage() {
    this.stopRecordingStream();

    this.setState({
      isRecording: false,
      isPaused: true,
      isPlaying: false,
    }, () => this.props.onStoppedRecording());
  }

  private onSendVoiceMessage() {
      console.log(`[vince][mic] Sending voice message`);
  }

  private async initiateRecordingStream() {
    navigator.getUserMedia({audio:true}, this.onRecordingStream, this.onStreamError);
  }

  private stopRecordingStream() {
    const { streamParams, updateTimerInterval} = this.state;
    updateTimerInterval && clearInterval(updateTimerInterval);
    
    // Exit if parameters aren't yet set
    if (!streamParams){
      return;
    }
    
    // Stop the stream
    streamParams.media.stop();
    streamParams.input.disconnect();
    streamParams.processor.disconnect();
    streamParams.stream.getTracks().forEach((track: any) => track.stop);
    
    console.log(`[vince][stream] Stream: `, streamParams.stream);
    console.log(`[vince][stream] Media: `, streamParams.media);
    console.log(`[vince][stream] Input: `, streamParams.input);
    console.log(`[vince][stream] Processor: `, streamParams.processor);
    
    // Stop recording
    this.stopRecording();
  }

  private onRecordingStream(stream: any) {
    // If not recording, stop stream
    if (!this.state.isRecording) {
      this.stopRecordingStream();
      return;
    }

    // Start recording the stream
    const media = new window.MediaRecorder(stream);
    media.ondataavailable = (mediaBlob: any) => {
      this.setState({mediaBlob});
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
      const streamParams = {stream, media, input, processor};
      this.setState({streamParams});

      // Array of volumes by frequency (not in Hz, arbitrary unit)
      const freqTypedArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(freqTypedArray);

      const freqArray = Array.from(freqTypedArray);

      const VISUALISATION_WIDTH = this.visualisationRef.current?.clientWidth;
      
      const maxVisualisationHeight = 30;
      const minVisualisationHeight = 3;

      // CANVAS CONTEXT
      const drawRecordingCanvas = () => {
        const canvas = this.visualisationCanvas.current;
        const CANVAS_HEIGHT = 35;
        const CANVAS_WIDTH = VISUALISATION_WIDTH || 600;

        const barPadding = 3;
        const barWidth = 4;

        const numBars = CANVAS_WIDTH / (barPadding + barWidth);
        
        let volumeArray = freqArray.map(n => {
          const maxVal = Math.max(...freqArray);
          const initialHeight = maxVisualisationHeight * (n / maxVal);
          const freqBarHeight = initialHeight > minVisualisationHeight
            ? initialHeight
            : minVisualisationHeight;
  
          return freqBarHeight;
        });
        
        // Create initial fake bars to improve appearance.
        // Gradually increasing wave rather than a wall at the beginning
        const frontLoadLen = Math.ceil(volumeArray.length / 10);
        const frontLoad = volumeArray.slice(0, frontLoadLen - 1).reverse().map(n => n * 0.80);
        volumeArray = [...frontLoad, ...volumeArray];
        
        // Chop off values which exceed the bounds of the container
        volumeArray = volumeArray.slice(0, numBars);

        canvas && (canvas.height = CANVAS_HEIGHT);
        canvas && (canvas.width = CANVAS_WIDTH);
        const canvasContext = canvas && (canvas.getContext(`2d`));
        
        for (var i = 0; i < volumeArray.length; i++) {
          const barHeight = Math.ceil(volumeArray[i]);
          const offset_x = Math.ceil(i * (barWidth + barPadding));
          const offset_y = Math.ceil((CANVAS_HEIGHT / 2 ) - (barHeight / 2 ));
          const radius = 15;

          // FIXME VINCE - Globalise JS references to colors
          canvasContext && (canvasContext.fillStyle = '#AFAFAF');
          canvasContext && this.drawRoundedRect(
            canvasContext,
            offset_x,
            offset_y,
            barWidth,
            barHeight,
            radius,
          );
        }
      }

      this.state.isRecording && requestAnimationFrame(drawRecordingCanvas);
    }

    // Init listeners for visualisation
    input.connect(analyser);
    processor.connect(audioContext.destination);
  }

  private onStreamError(error: any) {
    return error;
  }

  private compactPCM(array: Float32Array<number>, numGroups: number) {
    // Takes an array of arbitary size and compresses it down into a smaller
    // array, by grouping elements into bundles of groupSize and taking their
    // average.
    // Eg. [73, 6, 1, 9, 5, 11, 2, 19, 35] of groupSize 3, becomes
    // = [(73 + 6 + 1) / 3 + (9 + 5 + 11) / 3 + (2 + 19 + 35) / 3]
    // = [27, 8, 19]
    // It's used to get a fixed number of freqBars or volumeBars out of 
    // a huge sample array.

    const groupSize = Math.floor(array.length / numGroups);

    let compacted = new Float32Array(numGroups);
    let sum = 0;
    for (let i = 0; i < array.length; i++){
      sum += array[i];

      if ((i + 1) % groupSize === 0){
        const compactedIndex = ((i + 1) / groupSize)
        const average = sum / groupSize;
        compacted[compactedIndex] = average;
        sum = 0;
      }
    }

    return compacted;
  }

  private async onPlaybackStream() {
    const VISUALISATION_WIDTH = this.playbackCanvas.current?.clientWidth;
    const CANVAS_WIDTH = VISUALISATION_WIDTH || 600;
    const barPadding = 3;
    const barWidth = 4;
    const numBars = CANVAS_WIDTH / (barPadding + barWidth);

    const startPlayingTimestamp = moment().format('x') / 1000;
    
    // Then scan through audio file getting average volume per bar
    // to display amplitude over time as a static image
    const blob = this.state.mediaBlob.data;
    
    const arrayBuffer = await new Response(blob).arrayBuffer();
    const audioContext = new window.AudioContext();
    
    let audioDuration = 0;
    audioContext.decodeAudioData(arrayBuffer, (buffer: AudioBuffer) => {
      audioDuration = buffer.duration;

      // Get audio amplitude with PCM Data in Float32
      // Grab single channel only to save compuation
      const channelData = buffer.getChannelData(0);
      const pcmData = this.compactPCM(channelData, numBars);
      const pcmDataArray = Array.from(pcmData);
      const pcmDataArrayNormalised = pcmDataArray.map(v => Math.abs(v));
      
      // Prepare values for drawing to canvas
      const maxVisualisationHeight = 30;
      const minVisualisationHeight = 3;
      const maxAmplitude = Math.max(...pcmDataArrayNormalised);

      const barSizeArray = pcmDataArrayNormalised.map(amplitude => {
        let barSize = maxVisualisationHeight * (amplitude / maxAmplitude);
        
        // Prevent values that are too small
        if (barSize < minVisualisationHeight){
          barSize = minVisualisationHeight;
        }

        return barSize;
      });

      // CANVAS CONTEXT
      let playbackAnimationID;
      const drawPlaybackCanvas = () => {
        const canvas = this.playbackCanvas.current;
        const CANVAS_HEIGHT = 35;

        canvas.height = CANVAS_HEIGHT;
        canvas.width = CANVAS_WIDTH;

        const canvasContext = canvas.getContext(`2d`);
        
        for (let i = 0; i < barSizeArray.length; i++){
          const barHeight = Math.ceil(barSizeArray[i]);
          const offset_x = Math.ceil(i * (barWidth + barPadding));
          const offset_y = Math.ceil((CANVAS_HEIGHT / 2 ) - (barHeight / 2 ));
          const radius = 15;

          // FIXME VINCE - Globalise JS references to colors
          canvasContext.fillStyle = '#AFAFAF';

          this.drawRoundedRect(
            canvasContext,
            offset_x,
            offset_y,
            barWidth,
            barHeight,
            radius,
          );
        }

        // Draw sweeping timeline
        const now = moment().format('x') / 1000;
        const progress = CANVAS_WIDTH * ((now - startPlayingTimestamp) / audioDuration);
        
        canvasContext.beginPath();
        canvasContext.fillStyle = '#FFFFFF';
        canvasContext.globalCompositeOperation = 'source-atop';
        canvasContext.fillRect(0, 0, progress, CANVAS_HEIGHT);
        
        playbackAnimationID = requestAnimationFrame(drawPlaybackCanvas);
      }

      requestAnimationFrame(drawPlaybackCanvas);

    });

    // FIXME VINCE SET ASUIDO DURATION TO STATE
    await this.setState({recordDuration: audioDuration});

    // this.state.isPlaying && requestAnimationFrame(drawPlaybackCanvas);
      

  }

  private drawRoundedRect (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y,   x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x,   y+h, r);
    ctx.arcTo(x,   y+h, x,   y,   r);
    ctx.arcTo(x,   y,   x+w, y,   r);
    ctx.closePath();
    ctx.fill();
  }

  private onKeyDown(event: any) {
    if (event.key === 'Escape') {
      // FIXME VINCE: Add SessionConfirm
      this.onDeleteVoiceMessage();
    }
  }
  
}
