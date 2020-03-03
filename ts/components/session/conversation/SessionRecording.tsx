import React from 'react';


import {  SessionIconButton, SessionIconSize, SessionIconType } from '../icon';
import { SessionButton, SessionButtonType, SessionButtonColor } from '../SessionButton';


interface Props {
  onStoppedRecording: any;
  onStartedRecording: any;
}

interface State {
  recordDuration: number;
  isRecording: boolean;
  isPaused: boolean;
  actionHover: boolean;
  mediaSetting?: boolean;
  volumeArray?: Array<number>;
}

export class SessionRecording extends React.Component<Props, State> {
  private visualisationRef: React.RefObject<HTMLDivElement>;
  private visualisationCanvas: React.RefObject<HTMLCanvasElement>;

  constructor(props: any) {
    super(props);

    this.state = {
      recordDuration: 0,
      isRecording: true,
      isPaused: false,
      actionHover: false,
      mediaSetting: undefined,
      volumeArray: undefined,
    };
    
    this.handleHoverActions = this.handleHoverActions.bind(this);
    this.handleUnhoverActions = this.handleUnhoverActions.bind(this);
    
    this.playRecording = this.playRecording.bind(this);
    this.stopRecording = this.stopRecording.bind(this);

    this.onSendVoiceMessage = this.onSendVoiceMessage.bind(this);
    this.onDeleteVoiceMessage = this.onDeleteVoiceMessage.bind(this);

    this.onStream = this.onStream.bind(this);

    this.visualisationRef = React.createRef();
    this.visualisationCanvas = React.createRef();
  }

  public async componentWillMount(){
    // This turns on the microphone on the system. Later we need to turn it off.

    this.initiateStream();

  }



  render() {
    const actionPause = (this.state.actionHover && this.state.isRecording);
    const actionPlay = (!this.state.isRecording || this.state.isPaused);
    const actionDefault = !actionPause && !actionPlay;

    return (
      <div className="session-recording">
        <div
            className="session-recording--actions"
            onMouseEnter={this.handleHoverActions}
            onMouseLeave={this.handleUnhoverActions}
        >
            {actionPause && (
              <SessionIconButton
                iconType={SessionIconType.Pause}
                iconSize={SessionIconSize.Medium}
                // FIXME VINCE: Globalise constants for JS Session Colors
                iconColor={'#FF4538'}
                onClick={this.stopRecording}
              />
            )}
            {actionPlay && (
              <SessionIconButton
                iconType={SessionIconType.Play}
                iconSize={SessionIconSize.Medium}
                onClick={this.playRecording}
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
        

        <div className="send-message-button">
          <SessionIconButton
            iconType={SessionIconType.Send}
            iconSize={SessionIconSize.Large}
            iconColor={'#FFFFFF'}
            iconRotation={90}
            onClick={this.onSendVoiceMessage}
          />
        </div>

        <div className="session-recording--delete">
          <SessionButton
              text={window.i18n('delete')}
              buttonType={SessionButtonType.Brand}
              buttonColor={SessionButtonColor.DangerAlt}
              onClick={this.onDeleteVoiceMessage}
          />
        </div>
      </div>
    );
  }
  
  public blobToFile (data: any, fileName:string) {
    const file = new File([data.blob], fileName);
    console.log(`[vince][mic] File: `, file);
    return file;
  }

  private handleHoverActions() {
    if ((this.state.isRecording) && !this.state.actionHover) {
        this.setState({
            actionHover: true,
        });
    }
  }

  private handleUnhoverActions() {
    if (this.state.isRecording && this.state.actionHover) {
        this.setState({
            actionHover: false,
        });
    }
  }

  private stopRecording() {
    console.log(`[vince][mic] Stopped recording`);
  
    this.setState({
        isRecording: false,
        isPaused: true,
    });
  }

  private playRecording() {
      console.log(`[vince][mic] Playing recording`);

      this.setState({
        isRecording: false,
        isPaused: false,
    });
  }

  private initSendVoiceRecording(){
    return;
  }

  private onDeleteVoiceMessage() {
    //this.stopRecording();
    this.setState({
      isRecording: false,
      isPaused: true,
    }, () => this.props.onStoppedRecording());
  }

  private onSendVoiceMessage() {
      console.log(`[vince][mic] Sending voice message`);
  }

  private async initiateStream() {
    navigator.getUserMedia({audio:true}, this.onStream, this.onStreamError);
    
    //const mediaStreamSource = audioContext.createMediaStreamSource(stream);
    //const meter = getMeter(audioContext);
    //mediaStreamSource.connect(meter);
  }

  private onStream(stream: any) {
    
    // AUDIO CONTEXT
    const audioContext = new window.AudioContext();
    const input = audioContext.createMediaStreamSource(stream);
    
    const bufferSize = 1024;
    const analyser = audioContext.createAnalyser();
    analyser.smoothingTimeConstant = 0.3;
    analyser.fftSize = 512;

    const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);

    processor.onaudioprocess = () => {
      // Array of volumes by frequency (not in Hz, arbitrary unit)
      const freqTypedArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(freqTypedArray);

      const freqArray = Array.from(freqTypedArray);
      const VISUALISATION_WIDTH = this.visualisationRef.current?.clientWidth;
      
      const maxVisualisationHeight = 30;
      const minVisualisationHeight = 3;
    

      // CANVAS CONTEXT
      const drawCanvas = () => {
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
        
        // Chop off values which exceed the bouinds of the container
        volumeArray = volumeArray.slice(0, numBars);
        console.log(`[vince][mic] Width: `, VISUALISATION_WIDTH);
        

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

      requestAnimationFrame(drawCanvas);

    }
      

    // Get volume for visualisation
    input.connect(analyser);
    processor.connect(audioContext.destination);

    console.log(`[vince][mic] Freq:`, analyser.frequencyBinCount);

    //Start recording the stream
    const media = new window.MediaRecorder(stream);

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

