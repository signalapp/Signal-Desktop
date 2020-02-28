import React from 'react';

import {ReactMic} from 'react-mic';

import {  SessionIconButton, SessionIconSize, SessionIconType } from '../icon';
import { SessionButton, SessionButtonType, SessionButtonColor } from '../SessionButton';

interface Props {
  onStoppedRecording: any;
}

interface State {
  recordDuration: number;
  isRecording: boolean;
  isPaused: boolean;
  actionHover: boolean;
}

export class SessionRecording extends React.Component<Props, State> {

  constructor(props: any) {
    super(props);

    this.state = {
      recordDuration: 0,
      isRecording: true,
      isPaused: false,
      actionHover: false,
    };
    
    this.handleHoverActions = this.handleHoverActions.bind(this);
    this.handleUnhoverActions = this.handleUnhoverActions.bind(this);
    
    this.onPlayRecording = this.onPlayRecording.bind(this);
    this.onStopRecording = this.onStopRecording.bind(this);

    this.onSendVoiceMessage = this.onSendVoiceMessage.bind(this);
    this.onDeleteVoiceMessage = this.onDeleteVoiceMessage.bind(this);
  }

  public componentWillReceiveProps(){
    console.log(`[vince][mic] Here are my composition props: `, this.props);

    console.log(`[vince][mic] Permissions: `, navigator.getUserMedia({ audio: true }, () => null, error => alert(error)));
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
                onClick={this.onStopRecording}
              />
            )}
            {actionPlay && (
              <SessionIconButton
                iconType={SessionIconType.Play}
                iconSize={SessionIconSize.Medium}
                onClick={this.onPlayRecording}
              />
            )}
            
            {actionDefault && (
              <SessionIconButton
                iconType={SessionIconType.Microphone}
                iconSize={SessionIconSize.Huge}
              />
            )}
        </div>

        <ReactMic
            record={this.state.isRecording}
            className='session-recording--visualisation'
            onStop={() => null}
            onData= {(data: any) => console.log(`[vince][mic] Data:`, data)}
            strokeColor={'#00F480'}
            backgroundColor={'blue'}
        />


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

  private onStopRecording() {
    console.log(`[vince][mic] Stopped recording`);
  
    this.setState({
        isRecording: false,
        isPaused: true,
    });
  }

  private onPlayRecording() {
      console.log(`[vince][mic] Playing recording`);

      this.setState({
        isRecording: false,
        isPaused: false,
    });
  }

  private onDeleteVoiceMessage() {
    this.onStopRecording();
    this.props.onStoppedRecording();
  }

  private onSendVoiceMessage() {
      console.log(`[vince][mic] Sending voice message`);
  }
}
