import React from 'react';
import classNames from 'classnames';
import moment from 'moment';

import { SessionIconButton, SessionIconSize, SessionIconType } from '../icon';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../SessionButton';
import { Constants } from '../../../session';
import { ToastUtils } from '../../../session/utils';
import autoBind from 'auto-bind';
import MicRecorder from 'mic-recorder-to-mp3';
import styled, { useTheme } from 'styled-components';

interface Props {
  onExitVoiceNoteView: any;
  onLoadVoiceNoteView: any;
  sendVoiceMessage: any;
}

interface State {
  recordDuration: number;
  isRecording: boolean;
  isPlaying: boolean;
  isPaused: boolean;

  actionHover: boolean;
  startTimestamp: number;
  nowTimestamp: number;

  updateTimerInterval: NodeJS.Timeout;
}

function getTimestamp(asInt = false) {
  const timestamp = Date.now() / 1000;
  return asInt ? Math.floor(timestamp) : timestamp;
}

export interface StyledFlexWrapperProps {
  flexDirection: 'row' | 'column';
  marginHorizontal: string;
}

/**
 * Generic wrapper for quickly passing in theme constant values.
 */
export const StyledFlexWrapper = styled.div`
  display: flex;
  flex-direction: ${(props: StyledFlexWrapperProps) => props.flexDirection};
  align-items: center;

  .session-button {
    margin: ${(props: StyledFlexWrapperProps) => props.marginHorizontal};
  }
`;

class SessionRecordingInner extends React.Component<Props, State> {
  private recorder: any;
  private audioBlobMp3?: Blob;
  private audioElement?: HTMLAudioElement | null;

  constructor(props: Props) {
    super(props);

    autoBind(this);

    // Refs

    const now = getTimestamp();
    const updateTimerInterval = global.setInterval(this.timerUpdate, 500);

    this.state = {
      recordDuration: 0,
      isRecording: true,
      isPlaying: false,
      isPaused: false,
      actionHover: false,
      startTimestamp: now,
      nowTimestamp: now,
      updateTimerInterval,
    };
  }

  public componentWillMount() {
    // This turns on the microphone on the system. Later we need to turn it off.
    void this.initiateRecordingStream();
  }

  public componentDidMount() {
    // Callback to parent on load complete
    if (this.props.onLoadVoiceNoteView) {
      this.props.onLoadVoiceNoteView();
    }
  }

  public componentWillUnmount() {
    clearInterval(this.state.updateTimerInterval);
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
    } = this.state;

    const hasRecordingAndPaused = !isRecording && !isPlaying;
    const actionPauseAudio = !isRecording && !isPaused && isPlaying;

    // const actionDefault = !actionStopRecording && !actionPlayAudio && !actionPauseAudio;
    const actionDefault = !isRecording && !hasRecordingAndPaused && !actionPauseAudio;

    // if we are recording, we base the time recording on our state values
    // if we are playing ( audioElement?.currentTime is !== 0, use that instead)
    // if we are not playing but we have an audioElement, display its duration
    // otherwise display 0
    const displayTimeMs = isRecording
      ? (nowTimestamp - startTimestamp) * 1000
      : (this.audioElement &&
        (this.audioElement?.currentTime * 1000 || this.audioElement?.duration)) ||
      0;
    let displayTimeString = moment.utc(displayTimeMs).format('m:ss');

    const recordingLengthMs = this.audioElement?.duration ? this.audioElement?.duration * 1000 : undefined;

    let remainingTimeString;
    if (recordingLengthMs !== undefined) {
      console.log({ recordingLengthMs });
      console.log({ displayTimeMs });
      remainingTimeString = ` / ${moment.utc(recordingLengthMs).format('m:ss')}`;
      displayTimeString += remainingTimeString;
    }

    const actionPauseFn = isPlaying ? this.pauseAudio : this.stopRecordingStream;

    return (
      <div role="main" className="session-recording" tabIndex={0} onKeyDown={this.onKeyDown}>
        <div
          className="session-recording--actions"
          onMouseEnter={this.handleHoverActions}
          onMouseLeave={this.handleUnhoverActions}
        >
          {isRecording && (
            <SessionIconButton
              iconType={SessionIconType.Pause}
              iconSize={SessionIconSize.Medium}
              iconColor={Constants.UI.COLORS.DANGER_ALT}
              onClick={actionPauseFn}
            />
          )}
          {actionPauseAudio && (
            <SessionIconButton
              iconType={SessionIconType.Pause}
              iconSize={SessionIconSize.Medium}
              onClick={actionPauseFn}
            />
          )}
          {hasRecordingAndPaused && (
            <StyledFlexWrapper
              flexDirection='row'
              marginHorizontal={Constants.UI.SPACING.marginXs}
            >
              <SessionIconButton
                iconType={SessionIconType.Play}
                iconSize={SessionIconSize.Medium}
                onClick={this.playAudio}
              />
              <SessionButton
                text={window.i18n('delete')}
                buttonType={SessionButtonType.Brand}
                buttonColor={SessionButtonColor.Secondary}
                onClick={this.onDeleteVoiceMessage}
              />
            </StyledFlexWrapper>
          )}

          {actionDefault && (
            <SessionIconButton
              iconType={SessionIconType.Microphone}
              iconSize={SessionIconSize.Huge}
            />
          )}
        </div>

        {isRecording || (!isRecording && remainingTimeString) ?
          <div className={classNames('session-recording--timer', !isRecording && 'playback-timer')}>
            {displayTimeString}
            {isRecording && <div className="session-recording--timer-light" />}
          </div>
          :
          null
        }

        {!isRecording && (
          <div className="send-message-button">
            <SessionIconButton
              iconType={SessionIconType.Send}
              iconSize={SessionIconSize.Large}
              iconRotation={90}
              onClick={this.onSendVoiceMessage}
            />
          </div>
        )}

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

  private stopRecordingState() {
    this.setState({
      isRecording: false,
      isPaused: true,
    });
  }

  private async playAudio() {
    // Generate audio element if it doesn't exist
    const { recordDuration } = this.state;

    if (!this.audioBlobMp3) {
      return;
    }

    if (this.audioElement) {
      window?.log?.info('Audio element already init');
    } else {
      const audioURL = window.URL.createObjectURL(this.audioBlobMp3);
      this.audioElement = new Audio(audioURL);

      this.audioElement.loop = false;
      this.audioElement.onended = () => {
        this.pauseAudio();
      };

      this.audioElement.oncanplaythrough = async () => {
        const duration = recordDuration;

        if (duration && this.audioElement && this.audioElement.currentTime < duration) {
          await this.audioElement?.play();
        }
      };
    }

    this.setState({
      isRecording: false,
      isPaused: false,
      isPlaying: true,
    });

    await this.audioElement.play();
  }

  private pauseAudio() {
    if (this.audioElement) {
      this.audioElement.pause();
    }
    this.setState({
      isPlaying: false,
      isPaused: true,
    });
  }

  private async onDeleteVoiceMessage() {
    this.pauseAudio();
    await this.stopRecordingStream();
    this.audioBlobMp3 = undefined;
    this.audioElement = null;
    this.props.onExitVoiceNoteView();
  }

  /**
   * Sends the recorded voice message
   */
  private async onSendVoiceMessage() {
    if (!this.audioBlobMp3 || !this.audioBlobMp3.size) {
      window?.log?.info('Empty audio blob');
      return;
    }

    // Is the audio file > attachment filesize limit
    if (this.audioBlobMp3.size > Constants.CONVERSATION.MAX_ATTACHMENT_FILESIZE_BYTES) {
      ToastUtils.pushFileSizeErrorAsByte(Constants.CONVERSATION.MAX_ATTACHMENT_FILESIZE_BYTES);
      return;
    }

    this.props.sendVoiceMessage(this.audioBlobMp3);
  }

  private async initiateRecordingStream() {
    // Start recording. Browser will request permission to use your microphone.
    if (this.recorder) {
      await this.stopRecordingStream();
    }

    this.recorder = new MicRecorder({
      bitRate: 128,
    });
    this.recorder
      .start()
      .then(() => {
        // something else
      })
      .catch((e: any) => {
        window?.log?.error(e);
      });
  }

  /**
   * Stops recording audio, sets recording state to stopped.
   */
  private async stopRecordingStream() {
    if (!this.recorder) {
      return;
    }
    const [_, blob] = await this.recorder.stop().getMp3();
    this.recorder = undefined;

    this.audioBlobMp3 = blob;
    this.updateAudioElementAndDuration();

    // Stop recording
    this.stopRecordingState();
  }

  private async onStopRecordingClick() {
    this.stopRecordingStream();
    this.updateAudioElementAndDuration();
    this.stopRecordingState();
  }



  /**
   * Creates an audio element using the recorded audio blob. 
   * Updates the duration for displaying audio duration.
   */
  private updateAudioElementAndDuration() {
    // init audio element
    const audioURL = window.URL.createObjectURL(this.audioBlobMp3);
    this.audioElement = new Audio(audioURL);

    // ww adding record duration
    this.setState({
      recordDuration: this.audioElement.duration
    })

    this.audioElement.loop = false;
    this.audioElement.onended = () => {
      this.pauseAudio();
    };

    this.audioElement.oncanplaythrough = async () => {
      const duration = this.state.recordDuration;

      if (duration && this.audioElement && this.audioElement.currentTime < duration) {
        await this.audioElement?.play();
      }
    };
  }

  private async onKeyDown(event: any) {
    if (event.key === 'Escape') {
      await this.onDeleteVoiceMessage();
    }
  }
}

export const SessionRecording = SessionRecordingInner;
