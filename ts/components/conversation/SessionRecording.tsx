/* eslint-disable @typescript-eslint/no-misused-promises */
import React from 'react';
import classNames from 'classnames';
import moment from 'moment';

import autoBind from 'auto-bind';
import MicRecorder from 'mic-recorder-to-mp3';
import styled from 'styled-components';
import { SessionIconButton } from '../icon';
import { Constants } from '../../session';
import { ToastUtils } from '../../session/utils';
import { MAX_ATTACHMENT_FILESIZE_BYTES } from '../../session/constants';

interface Props {
  onExitVoiceNoteView: () => void;
  onLoadVoiceNoteView: () => void;
  sendVoiceMessage: (audioBlob: Blob) => Promise<void>;
}

interface State {
  recordDuration: number;
  isRecording: boolean;
  isPlaying: boolean;
  isPaused: boolean;

  actionHover: boolean;
  startTimestamp: number;
  nowTimestamp: number;
}

function getTimestamp() {
  return Date.now() / 1000;
}

interface StyledFlexWrapperProps {
  marginHorizontal: string;
}

/**
 * Generic wrapper for quickly passing in theme constant values.
 */
const StyledFlexWrapper = styled.div<StyledFlexWrapperProps>`
  display: flex;
  flex-direction: row;
  align-items: center;

  .session-button {
    margin: ${props => props.marginHorizontal};
  }
`;

export class SessionRecording extends React.Component<Props, State> {
  private recorder?: any;
  private audioBlobMp3?: Blob;
  private audioElement?: HTMLAudioElement | null;
  private updateTimerInterval?: NodeJS.Timeout;

  constructor(props: Props) {
    super(props);
    autoBind(this);
    const now = getTimestamp();

    this.state = {
      recordDuration: 0,
      isRecording: true,
      isPlaying: false,
      isPaused: false,
      actionHover: false,
      startTimestamp: now,
      nowTimestamp: now,
    };
  }

  public componentDidMount() {
    // This turns on the microphone on the system. Later we need to turn it off.

    void this.initiateRecordingStream();
    // Callback to parent on load complete

    if (this.props.onLoadVoiceNoteView) {
      this.props.onLoadVoiceNoteView();
    }
    this.updateTimerInterval = global.setInterval(this.timerUpdate, 500);
  }

  public componentWillUnmount() {
    if (this.updateTimerInterval) {
      clearInterval(this.updateTimerInterval);
    }
  }

  public render() {
    const { isPlaying, isPaused, isRecording, startTimestamp, nowTimestamp } = this.state;

    const hasRecordingAndPaused = !isRecording && !isPlaying;
    const hasRecording = !!this.audioElement?.duration && this.audioElement?.duration > 0;
    const actionPauseAudio = !isRecording && !isPaused && isPlaying;
    const actionDefault = !isRecording && !hasRecordingAndPaused && !actionPauseAudio;

    // if we are recording, we base the time recording on our state values
    // if we are playing ( audioElement?.currentTime is !== 0, use that instead)
    // if we are not playing but we have an audioElement, display its duration
    // otherwise display 0
    const displayTimeMs = isRecording
      ? (nowTimestamp - startTimestamp) * 1000
      : (this.audioElement?.currentTime &&
          (this.audioElement.currentTime * 1000 || this.audioElement?.duration)) ||
        0;

    const displayTimeString = moment.utc(displayTimeMs).format('m:ss');
    const recordingDurationMs = this.audioElement?.duration ? this.audioElement.duration * 1000 : 1;

    let remainingTimeString = '';
    if (recordingDurationMs !== undefined) {
      remainingTimeString = ` / ${moment.utc(recordingDurationMs).format('m:ss')}`;
    }

    const actionPauseFn = isPlaying ? this.pauseAudio : this.stopRecordingStream;

    return (
      <div role="main" className="session-recording" tabIndex={0} onKeyDown={this.onKeyDown}>
        <div className="session-recording--actions">
          <StyledFlexWrapper marginHorizontal="5px">
            {isRecording && (
              <SessionIconButton
                iconType="stop"
                iconSize="medium"
                iconColor={'var(--danger-color)'}
                onClick={actionPauseFn}
                dataTestId="end-voice-message"
              />
            )}
            {actionPauseAudio && (
              <SessionIconButton iconType="pause" iconSize="medium" onClick={actionPauseFn} />
            )}
            {hasRecordingAndPaused && (
              <SessionIconButton iconType="play" iconSize="medium" onClick={this.playAudio} />
            )}
            {hasRecording && (
              <SessionIconButton
                iconType="delete"
                iconSize="medium"
                onClick={this.onDeleteVoiceMessage}
              />
            )}
          </StyledFlexWrapper>

          {actionDefault && <SessionIconButton iconType="microphone" iconSize={'huge'} />}
        </div>

        {hasRecording && !isRecording ? (
          <div className={classNames('session-recording--timer', !isRecording && 'playback-timer')}>
            {displayTimeString + remainingTimeString}
          </div>
        ) : null}

        {isRecording ? (
          <div className={classNames('session-recording--timer')}>
            {displayTimeString}
            <div className="session-recording--timer-light" />
          </div>
        ) : null}

        {!isRecording && (
          <div
            className={classNames(
              'send-message-button',
              hasRecording && 'send-message-button---scale'
            )}
          >
            <SessionIconButton
              iconType="send"
              iconSize={'large'}
              iconRotation={90}
              onClick={this.onSendVoiceMessage}
              margin={'var(--margins-sm)'}
              dataTestId="send-message-button"
            />
          </div>
        )}
      </div>
    );
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
    if (this.audioBlobMp3.size > MAX_ATTACHMENT_FILESIZE_BYTES) {
      ToastUtils.pushFileSizeErrorAsByte(MAX_ATTACHMENT_FILESIZE_BYTES);
      return;
    }

    void this.props.sendVoiceMessage(this.audioBlobMp3);
  }

  private async initiateRecordingStream() {
    // Start recording. Browser will request permission to use your microphone.
    if (this.recorder) {
      await this.stopRecordingStream();
    }

    this.recorder = new MicRecorder({
      bitRate: 128,
    });
    // eslint-disable-next-line more/no-then
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_, blob] = await this.recorder.stop().getMp3();
    this.recorder = undefined;

    this.audioBlobMp3 = blob;
    this.updateAudioElementAndDuration();

    // Stop recording
    this.stopRecordingState();
  }

  /**
   * Creates an audio element using the recorded audio blob.
   * Updates the duration for displaying audio duration.
   */
  private updateAudioElementAndDuration() {
    // init audio element
    if (!this.audioBlobMp3) {
      return;
    }
    const audioURL = window.URL.createObjectURL(this.audioBlobMp3);
    this.audioElement = new Audio(audioURL);

    this.setState({
      recordDuration: this.audioElement.duration,
    });

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
