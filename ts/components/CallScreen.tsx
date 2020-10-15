import React from 'react';
import classNames from 'classnames';
import {
  CallDetailsType,
  HangUpType,
  SetLocalAudioType,
  SetLocalPreviewType,
  SetLocalVideoType,
  SetRendererCanvasType,
} from '../state/ducks/calling';
import { Avatar } from './Avatar';
import { CallingButton, CallingButtonType } from './CallingButton';
import { CallState } from '../types/Calling';
import { LocalizerType } from '../types/Util';

export type PropsType = {
  callDetails?: CallDetailsType;
  callState?: CallState;
  hangUp: (_: HangUpType) => void;
  hasLocalAudio: boolean;
  hasLocalVideo: boolean;
  hasRemoteVideo: boolean;
  i18n: LocalizerType;
  setLocalAudio: (_: SetLocalAudioType) => void;
  setLocalVideo: (_: SetLocalVideoType) => void;
  setLocalPreview: (_: SetLocalPreviewType) => void;
  setRendererCanvas: (_: SetRendererCanvasType) => void;
  togglePip: () => void;
  toggleSettings: () => void;
};

type StateType = {
  acceptedDuration: number | null;
  showControls: boolean;
};

export class CallScreen extends React.Component<PropsType, StateType> {
  private interval: NodeJS.Timeout | null;

  private controlsFadeTimer: NodeJS.Timeout | null;

  private readonly localVideoRef: React.RefObject<HTMLVideoElement>;

  private readonly remoteVideoRef: React.RefObject<HTMLCanvasElement>;

  constructor(props: PropsType) {
    super(props);

    this.state = {
      acceptedDuration: null,
      showControls: true,
    };

    this.interval = null;
    this.controlsFadeTimer = null;
    this.localVideoRef = React.createRef();
    this.remoteVideoRef = React.createRef();
  }

  public componentDidMount(): void {
    const { setLocalPreview, setRendererCanvas } = this.props;

    // It's really jump with a value of 500ms.
    this.interval = setInterval(this.updateAcceptedTimer, 100);
    this.fadeControls();

    document.addEventListener('keydown', this.handleKeyDown);

    setLocalPreview({ element: this.localVideoRef });
    setRendererCanvas({ element: this.remoteVideoRef });
  }

  public componentWillUnmount(): void {
    const { setLocalPreview, setRendererCanvas } = this.props;

    document.removeEventListener('keydown', this.handleKeyDown);

    if (this.interval) {
      clearInterval(this.interval);
    }
    if (this.controlsFadeTimer) {
      clearTimeout(this.controlsFadeTimer);
    }

    setLocalPreview({ element: undefined });
    setRendererCanvas({ element: undefined });
  }

  updateAcceptedTimer = (): void => {
    const { callDetails } = this.props;

    if (!callDetails) {
      return;
    }

    if (callDetails.acceptedTime) {
      this.setState({
        acceptedDuration: Date.now() - callDetails.acceptedTime,
      });
    }
  };

  handleKeyDown = (event: KeyboardEvent): void => {
    const { callDetails } = this.props;

    if (!callDetails) {
      return;
    }

    let eventHandled = false;

    if (event.shiftKey && (event.key === 'V' || event.key === 'v')) {
      this.toggleVideo();
      eventHandled = true;
    } else if (event.shiftKey && (event.key === 'M' || event.key === 'm')) {
      this.toggleAudio();
      eventHandled = true;
    }

    if (eventHandled) {
      event.preventDefault();
      event.stopPropagation();
      this.showControls();
    }
  };

  showControls = (): void => {
    const { showControls } = this.state;

    if (!showControls) {
      this.setState({
        showControls: true,
      });
    }

    this.fadeControls();
  };

  fadeControls = (): void => {
    if (this.controlsFadeTimer) {
      clearTimeout(this.controlsFadeTimer);
    }

    this.controlsFadeTimer = setTimeout(() => {
      this.setState({
        showControls: false,
      });
    }, 5000);
  };

  toggleAudio = (): void => {
    const { callDetails, hasLocalAudio, setLocalAudio } = this.props;

    if (!callDetails) {
      return;
    }

    setLocalAudio({
      callId: callDetails.callId,
      enabled: !hasLocalAudio,
    });
  };

  toggleVideo = (): void => {
    const { callDetails, hasLocalVideo, setLocalVideo } = this.props;

    if (!callDetails) {
      return;
    }

    setLocalVideo({ callId: callDetails.callId, enabled: !hasLocalVideo });
  };

  public render(): JSX.Element | null {
    const {
      callDetails,
      callState,
      hangUp,
      hasLocalAudio,
      hasLocalVideo,
      hasRemoteVideo,
      i18n,
      togglePip,
      toggleSettings,
    } = this.props;
    const { showControls } = this.state;
    const isAudioOnly = !hasLocalVideo && !hasRemoteVideo;

    if (!callDetails || !callState) {
      return null;
    }

    const controlsFadeClass = classNames({
      'module-ongoing-call__controls--fadeIn':
        (showControls || isAudioOnly) && callState !== CallState.Accepted,
      'module-ongoing-call__controls--fadeOut':
        !showControls && !isAudioOnly && callState === CallState.Accepted,
    });

    const videoButtonType = hasLocalVideo
      ? CallingButtonType.VIDEO_ON
      : CallingButtonType.VIDEO_OFF;
    const audioButtonType = hasLocalAudio
      ? CallingButtonType.AUDIO_ON
      : CallingButtonType.AUDIO_OFF;

    return (
      <div
        className="module-calling__container"
        onMouseMove={this.showControls}
        role="group"
      >
        <div
          className={classNames(
            'module-calling__header',
            'module-ongoing-call__header',
            controlsFadeClass
          )}
        >
          <div className="module-calling__header--header-name">
            {callDetails.title}
          </div>
          {this.renderMessage(callState)}
          <div className="module-calling-tools">
            <button
              type="button"
              aria-label={i18n('callingDeviceSelection__settings')}
              className="module-calling-tools__button module-calling-button__settings"
              onClick={toggleSettings}
            />
            <button
              type="button"
              aria-label={i18n('calling__pip')}
              className="module-calling-tools__button module-calling-button__pip"
              onClick={togglePip}
            />
          </div>
        </div>
        {hasRemoteVideo
          ? this.renderRemoteVideo()
          : this.renderAvatar(callDetails)}
        {hasLocalVideo ? this.renderLocalVideo() : null}
        <div
          className={classNames(
            'module-ongoing-call__actions',
            controlsFadeClass
          )}
        >
          <CallingButton
            buttonType={videoButtonType}
            i18n={i18n}
            onClick={this.toggleVideo}
            tooltipDistance={24}
          />
          <CallingButton
            buttonType={audioButtonType}
            i18n={i18n}
            onClick={this.toggleAudio}
            tooltipDistance={24}
          />
          <CallingButton
            buttonType={CallingButtonType.HANG_UP}
            i18n={i18n}
            onClick={() => {
              hangUp({ callId: callDetails.callId });
            }}
            tooltipDistance={24}
          />
        </div>
      </div>
    );
  }

  private renderAvatar(callDetails: CallDetailsType) {
    const { i18n } = this.props;
    const {
      avatarPath,
      color,
      name,
      phoneNumber,
      profileName,
      title,
    } = callDetails;
    return (
      <div className="module-ongoing-call__remote-video-disabled">
        <Avatar
          avatarPath={avatarPath}
          color={color || 'ultramarine'}
          noteToSelf={false}
          conversationType="direct"
          i18n={i18n}
          name={name}
          phoneNumber={phoneNumber}
          profileName={profileName}
          title={title}
          size={112}
        />
      </div>
    );
  }

  private renderLocalVideo() {
    return (
      <video
        className="module-ongoing-call__local-video"
        ref={this.localVideoRef}
        autoPlay
      />
    );
  }

  private renderRemoteVideo() {
    return (
      <canvas
        className="module-ongoing-call__remote-video-enabled"
        ref={this.remoteVideoRef}
      />
    );
  }

  private renderMessage(callState: CallState) {
    const { i18n } = this.props;
    const { acceptedDuration } = this.state;

    let message = null;
    if (callState === CallState.Prering) {
      message = i18n('outgoingCallPrering');
    } else if (callState === CallState.Ringing) {
      message = i18n('outgoingCallRinging');
    } else if (callState === CallState.Reconnecting) {
      message = i18n('callReconnecting');
    } else if (callState === CallState.Accepted && acceptedDuration) {
      message = i18n('callDuration', [
        CallScreen.renderDuration(acceptedDuration),
      ]);
    }

    if (!message) {
      return null;
    }
    return <div className="module-ongoing-call__header-message">{message}</div>;
  }

  static renderDuration(ms: number): string {
    const secs = Math.floor((ms / 1000) % 60)
      .toString()
      .padStart(2, '0');
    const mins = Math.floor((ms / 60000) % 60)
      .toString()
      .padStart(2, '0');
    const hours = Math.floor(ms / 3600000);
    if (hours > 0) {
      return `${hours}:${mins}:${secs}`;
    }
    return `${mins}:${secs}`;
  }
}
