import React from 'react';
import moment from 'moment';

import {  SessionIconButton, SessionIconSize, SessionIconType } from '../icon';
import { SessionButton, SessionButtonType, SessionButtonColor } from '../SessionButton';


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
    this.onStream = this.onStream.bind(this);
    this.stopStream = this.stopStream.bind(this);

    this.visualisationRef = React.createRef();
    this.visualisationCanvas = React.createRef();

    const now = moment().unix();
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
      updateTimerInterval: updateTimerInterval,
    };
    

  }

  public async componentWillMount(){
    // This turns on the microphone on the system. Later we need to turn it off.
    this.initiateStream();
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

    const actionPauseFn = isPlaying ? this.pauseAudio : this.stopStream;


    return (
      <div className="session-recording">
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
          <canvas ref={this.visualisationCanvas}></canvas>
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
    const { nowTimestamp, startTimestamp } = this.state;
    const elapsedTime = nowTimestamp - startTimestamp;

    if (elapsedTime >= window.CONSTANTS.MAX_VOICE_MESSAGE_DURATION){
      clearInterval(this.state.updateTimerInterval);
      this.stopStream();
      return;
    }

    this.setState({
      nowTimestamp: moment().unix()
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
    const { mediaBlob, streamParams } = this.state;

    if (!mediaBlob){
      window.pushToast({
        title: 'There was an error playing your voice recording.',
      });
      return;
    }

    // Start playing recording
    const audioURL = window.URL.createObjectURL(mediaBlob.data);
    const audioElement = new Audio(audioURL);

    console.log(`[vince][stream] Audio Element: `, audioElement);
    console.log(`[vince][stream] AudioURL: `, audioURL);

    this.setState({
      audioElement,
      isRecording: false,
      isPaused: false,
      isPlaying: true,
    });

  }
  
  private pauseAudio() {
    this.state.audioElement?.pause();
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
    this.stopStream();

    this.setState({
      isRecording: false,
      isPaused: true,
      isPlaying: false,
    }, () => this.props.onStoppedRecording());
  }

  private onSendVoiceMessage() {
      console.log(`[vince][mic] Sending voice message`);
  }

  private async initiateStream() {
    navigator.getUserMedia({audio:true}, this.onStream, this.onStreamError);
  }

  private stopStream() {
    const {streamParams} = this.state;
    
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

  private onStream(stream: any) {
    // If not recording, stop stream
    if (!this.state.isRecording) {
      this.stopStream();
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
        
        for (var i = 0; i < freqArray.length; i++) {
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

      const drawPlayingCanvas = () => {
        return;
      }

      this.state.isRecording && requestAnimationFrame(drawRecordingCanvas);
      this.state.isPlaying && requestAnimationFrame(drawPlayingCanvas);
    }

    // Init listeners for visualisation visualisation
    input.connect(analyser);
    processor.connect(audioContext.destination);
  }


  private onStreamError(error: any) {
    return error;
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


  
}
