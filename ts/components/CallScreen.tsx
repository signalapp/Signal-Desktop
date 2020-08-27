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
import { CallState } from '../types/Calling';
import { LocalizerType } from '../types/Util';

type CallingButtonProps = {
  classNameSuffix: string;
  onClick: () => void;
};

const CallingButton = ({
  classNameSuffix,
  onClick,
}: CallingButtonProps): JSX.Element => {
  const className = classNames(
    'module-ongoing-call__icon',
    `module-ongoing-call__icon${classNameSuffix}`
  );

  return (
    <button className={className} onClick={onClick}>
      <div />
    </button>
  );
};

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
  toggleSettings: () => void;
};

type StateType = {
  acceptedTime: number | null;
  acceptedDuration: number | null;
  showControls: boolean;
};

export class CallScreen extends React.Component<PropsType, StateType> {
  private interval: any;
  private controlsFadeTimer: any;
  private readonly localVideoRef: React.RefObject<HTMLVideoElement>;
  private readonly remoteVideoRef: React.RefObject<HTMLCanvasElement>;

  constructor(props: PropsType) {
    super(props);

    this.state = {
      acceptedTime: null,
      acceptedDuration: null,
      showControls: true,
    };

    this.interval = null;
    this.controlsFadeTimer = null;
    this.localVideoRef = React.createRef();
    this.remoteVideoRef = React.createRef();
  }

  public componentDidMount() {
    // It's really jump with a value of 500ms.
    this.interval = setInterval(this.updateAcceptedTimer, 100);
    this.fadeControls();

    document.addEventListener('keydown', this.handleKeyDown);

    this.props.setLocalPreview({ element: this.localVideoRef });
    this.props.setRendererCanvas({ element: this.remoteVideoRef });
  }

  public componentWillUnmount() {
    document.removeEventListener('keydown', this.handleKeyDown);

    if (this.interval) {
      clearInterval(this.interval);
    }
    if (this.controlsFadeTimer) {
      clearTimeout(this.controlsFadeTimer);
    }
    this.props.setLocalPreview({ element: undefined });
    this.props.setRendererCanvas({ element: undefined });
  }

  updateAcceptedTimer = () => {
    const { acceptedTime } = this.state;
    const { callState } = this.props;

    if (acceptedTime) {
      this.setState({
        acceptedTime,
        acceptedDuration: Date.now() - acceptedTime,
      });
    } else if (
      callState === CallState.Accepted ||
      callState === CallState.Reconnecting
    ) {
      this.setState({
        acceptedTime: Date.now(),
        acceptedDuration: 1,
      });
    }
  };

  handleKeyDown = (event: KeyboardEvent) => {
    const { callDetails } = this.props;

    if (!callDetails) {
      return;
    }

    let eventHandled = false;

    if (event.key === 'V') {
      this.toggleVideo();
      eventHandled = true;
    } else if (event.key === 'M') {
      this.toggleAudio();
      eventHandled = true;
    }

    if (eventHandled) {
      event.preventDefault();
      event.stopPropagation();
      this.showControls();
    }
  };

  showControls = () => {
    if (!this.state.showControls) {
      this.setState({
        showControls: true,
      });
    }

    this.fadeControls();
  };

  fadeControls = () => {
    if (this.controlsFadeTimer) {
      clearTimeout(this.controlsFadeTimer);
    }

    this.controlsFadeTimer = setTimeout(() => {
      this.setState({
        showControls: false,
      });
    }, 5000);
  };

  toggleAudio = () => {
    const { callDetails, hasLocalAudio, setLocalAudio } = this.props;

    if (!callDetails) {
      return;
    }

    setLocalAudio({
      callId: callDetails.callId,
      enabled: !hasLocalAudio,
    });
  };

  toggleVideo = () => {
    const { callDetails, hasLocalVideo, setLocalVideo } = this.props;

    if (!callDetails) {
      return;
    }

    setLocalVideo({ callId: callDetails.callId, enabled: !hasLocalVideo });
  };

  public render() {
    const {
      callDetails,
      callState,
      hangUp,
      hasLocalAudio,
      hasLocalVideo,
      hasRemoteVideo,
      i18n,
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

    const toggleAudioSuffix = hasLocalAudio
      ? '--audio--enabled'
      : '--audio--disabled';
    const toggleVideoSuffix = hasLocalVideo
      ? '--video--enabled'
      : '--video--disabled';

    return (
      <div
        className="module-ongoing-call"
        onMouseMove={this.showControls}
        role="group"
      >
        <div
          className={classNames(
            'module-ongoing-call__header',
            controlsFadeClass
          )}
        >
          <div className="module-ongoing-call__header-name">
            {callDetails.title}
          </div>
          {this.renderMessage(callState)}
          <div className="module-ongoing-call__settings">
            <button
              aria-label={i18n('callingDeviceSelection__settings')}
              className="module-ongoing-call__settings--button"
              onClick={toggleSettings}
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
            classNameSuffix={toggleVideoSuffix}
            onClick={this.toggleVideo}
          />
          <CallingButton
            classNameSuffix={toggleAudioSuffix}
            onClick={this.toggleAudio}
          />
          <CallingButton
            classNameSuffix="--hangup"
            onClick={() => {
              hangUp({ callId: callDetails.callId });
            }}
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

    let message = null;
    if (callState === CallState.Prering) {
      message = i18n('outgoingCallPrering');
    } else if (callState === CallState.Ringing) {
      message = i18n('outgoingCallRinging');
    } else if (callState === CallState.Reconnecting) {
      message = i18n('callReconnecting');
    } else if (
      callState === CallState.Accepted &&
      this.state.acceptedDuration
    ) {
      message = i18n('callDuration', [
        this.renderDuration(this.state.acceptedDuration),
      ]);
    }

    if (!message) {
      return null;
    }
    return <div className="module-ongoing-call__header-message">{message}</div>;
  }

  private renderDuration(ms: number): string {
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
