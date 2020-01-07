// tslint:disable:react-a11y-anchors

import React from 'react';

import classNames from 'classnames';
import is from '@sindresorhus/is';

import * as GoogleChrome from '../util/GoogleChrome';
import * as MIME from '../types/MIME';

import { formatDuration } from '../util/formatDuration';
import { LocalizerType } from '../types/Util';

const Colors = {
  ICON_SECONDARY: '#b9b9b9',
};

const colorSVG = (url: string, color: string) => {
  return {
    WebkitMask: `url(${url}) no-repeat center`,
    WebkitMaskSize: '100%',
    backgroundColor: color,
  };
};

interface Props {
  close: () => void;
  contentType: MIME.MIMEType | undefined;
  i18n: LocalizerType;
  objectURL: string;
  caption?: string;
  isViewOnce: boolean;
  onNext?: () => void;
  onPrevious?: () => void;
  onSave?: () => void;
}
interface State {
  videoTime?: number;
}

const CONTROLS_WIDTH = 50;
const CONTROLS_SPACING = 10;

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  } as React.CSSProperties,
  mainContainer: {
    display: 'flex',
    flexDirection: 'row',
    flexGrow: 1,
    paddingTop: 40,
    paddingLeft: 40,
    paddingRight: 40,
    paddingBottom: 0,
    // To ensure that a large image doesn't overflow the flex layout
    minHeight: '50px',
    outline: 'none',
  } as React.CSSProperties,
  objectContainer: {
    position: 'relative',
    flexGrow: 1,
    display: 'inline-flex',
    justifyContent: 'center',
  } as React.CSSProperties,
  object: {
    flexGrow: 1,
    flexShrink: 0,
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
    outline: 'none',
  } as React.CSSProperties,
  caption: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'white',
    padding: '1em',
    paddingLeft: '3em',
    paddingRight: '3em',
    backgroundColor: 'rgba(192, 192, 192, .20)',
  } as React.CSSProperties,
  controlsOffsetPlaceholder: {
    width: CONTROLS_WIDTH,
    marginRight: CONTROLS_SPACING,
    flexShrink: 0,
  },
  controls: {
    width: CONTROLS_WIDTH,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    marginLeft: CONTROLS_SPACING,
  } as React.CSSProperties,
  navigationContainer: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 10,
  } as React.CSSProperties,
  saveButton: {
    marginTop: 10,
  },
  countdownContainer: {
    padding: 8,
  },
  iconButtonPlaceholder: {
    // Dimensions match `.iconButton`:
    display: 'inline-block',
    width: 50,
    height: 50,
  },
  timestampPill: {
    borderRadius: '15px',
    backgroundColor: '#000000',
    color: '#eeefef',
    fontSize: '16px',
    letterSpacing: '0px',
    lineHeight: '18px',
    // This cast is necessary or typescript chokes
    textAlign: 'center' as 'center',
    padding: '6px',
    paddingLeft: '18px',
    paddingRight: '18px',
  },
};

interface IconButtonProps {
  onClick?: () => void;
  style?: React.CSSProperties;
  type: 'save' | 'close' | 'previous' | 'next';
}

const IconButton = ({ onClick, style, type }: IconButtonProps) => {
  const clickHandler = (event: React.MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    if (!onClick) {
      return;
    }

    onClick();
  };

  return (
    <button
      onClick={clickHandler}
      className={classNames('iconButton', type)}
      style={style}
    />
  );
};

const IconButtonPlaceholder = () => (
  <div style={styles.iconButtonPlaceholder} />
);

const Icon = ({
  onClick,
  url,
}: {
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  url: string;
}) => (
  <button
    style={{
      ...styles.object,
      ...colorSVG(url, Colors.ICON_SECONDARY),
      maxWidth: 200,
    }}
    onClick={onClick}
  />
);

export class Lightbox extends React.Component<Props, State> {
  public readonly containerRef = React.createRef<HTMLDivElement>();
  public readonly videoRef = React.createRef<HTMLVideoElement>();
  public readonly focusRef = React.createRef<HTMLDivElement>();
  public previousFocus: any;

  public state = {
    videoTime: undefined,
  };

  public componentDidMount() {
    this.previousFocus = document.activeElement;

    const { isViewOnce } = this.props;

    const useCapture = true;
    document.addEventListener('keydown', this.onKeyDown, useCapture);

    const video = this.getVideo();
    if (video && isViewOnce) {
      video.addEventListener('timeupdate', this.onTimeUpdate);
    }

    // Wait until we're added to the DOM. ConversationView first creates this view, then
    //   appends its elements into the DOM.
    setTimeout(() => {
      this.playVideo();

      if (this.focusRef && this.focusRef.current) {
        this.focusRef.current.focus();
      }
    });
  }

  public componentWillUnmount() {
    if (this.previousFocus && this.previousFocus.focus) {
      this.previousFocus.focus();
    }

    const { isViewOnce } = this.props;

    const useCapture = true;
    document.removeEventListener('keydown', this.onKeyDown, useCapture);

    const video = this.getVideo();
    if (video && isViewOnce) {
      video.removeEventListener('timeupdate', this.onTimeUpdate);
    }
  }

  public getVideo() {
    if (!this.videoRef) {
      return;
    }

    const { current } = this.videoRef;
    if (!current) {
      return;
    }

    return current;
  }

  public playVideo() {
    const video = this.getVideo();
    if (!video) {
      return;
    }

    if (video.paused) {
      // tslint:disable-next-line no-floating-promises
      video.play();
    } else {
      video.pause();
    }
  }

  public render() {
    const {
      caption,
      contentType,
      i18n,
      isViewOnce,
      objectURL,
      onNext,
      onPrevious,
      onSave,
    } = this.props;
    const { videoTime } = this.state;

    return (
      <div
        className="module-lightbox"
        style={styles.container}
        onClick={this.onContainerClick}
        ref={this.containerRef}
        role="dialog"
      >
        <div style={styles.mainContainer} tabIndex={-1} ref={this.focusRef}>
          <div style={styles.controlsOffsetPlaceholder} />
          <div style={styles.objectContainer}>
            {!is.undefined(contentType)
              ? this.renderObject({ objectURL, contentType, i18n, isViewOnce })
              : null}
            {caption ? <div style={styles.caption}>{caption}</div> : null}
          </div>
          <div style={styles.controls}>
            <IconButton type="close" onClick={this.onClose} />
            {onSave ? (
              <IconButton
                type="save"
                onClick={onSave}
                style={styles.saveButton}
              />
            ) : null}
          </div>
        </div>
        {isViewOnce && is.number(videoTime) ? (
          <div style={styles.navigationContainer}>
            <div style={styles.timestampPill}>{formatDuration(videoTime)}</div>
          </div>
        ) : (
          <div style={styles.navigationContainer}>
            {onPrevious ? (
              <IconButton type="previous" onClick={onPrevious} />
            ) : (
              <IconButtonPlaceholder />
            )}
            {onNext ? (
              <IconButton type="next" onClick={onNext} />
            ) : (
              <IconButtonPlaceholder />
            )}
          </div>
        )}
      </div>
    );
  }

  private readonly renderObject = ({
    objectURL,
    contentType,
    i18n,
    isViewOnce,
  }: {
    objectURL: string;
    contentType: MIME.MIMEType;
    i18n: LocalizerType;
    isViewOnce: boolean;
  }) => {
    const isImageTypeSupported = GoogleChrome.isImageTypeSupported(contentType);
    if (isImageTypeSupported) {
      return (
        <img
          alt={i18n('lightboxImageAlt')}
          style={styles.object}
          src={objectURL}
          onClick={this.onObjectClick}
        />
      );
    }

    const isVideoTypeSupported = GoogleChrome.isVideoTypeSupported(contentType);
    if (isVideoTypeSupported) {
      return (
        <video
          ref={this.videoRef}
          loop={isViewOnce}
          controls={!isViewOnce}
          style={styles.object}
          key={objectURL}
        >
          <source src={objectURL} />
        </video>
      );
    }

    const isUnsupportedImageType =
      !isImageTypeSupported && MIME.isImage(contentType);
    const isUnsupportedVideoType =
      !isVideoTypeSupported && MIME.isVideo(contentType);
    if (isUnsupportedImageType || isUnsupportedVideoType) {
      const iconUrl = isUnsupportedVideoType
        ? 'images/video.svg'
        : 'images/image.svg';

      return <Icon url={iconUrl} onClick={this.onObjectClick} />;
    }

    // tslint:disable-next-line no-console
    console.log('Lightbox: Unexpected content type', { contentType });

    return <Icon onClick={this.onObjectClick} url="images/file.svg" />;
  };

  private readonly onClose = () => {
    const { close } = this.props;
    if (!close) {
      return;
    }

    close();
  };

  private readonly onTimeUpdate = () => {
    const video = this.getVideo();
    if (!video) {
      return;
    }
    this.setState({
      videoTime: video.currentTime,
    });
  };

  private readonly onKeyDown = (event: KeyboardEvent) => {
    const { onNext, onPrevious } = this.props;
    switch (event.key) {
      case 'Escape':
        this.onClose();

        event.preventDefault();
        event.stopPropagation();

        break;

      case 'ArrowLeft':
        if (onPrevious) {
          onPrevious();

          event.preventDefault();
          event.stopPropagation();
        }
        break;

      case 'ArrowRight':
        if (onNext) {
          onNext();

          event.preventDefault();
          event.stopPropagation();
        }
        break;

      default:
    }
  };

  private readonly onContainerClick = (
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    if (this.containerRef && event.target !== this.containerRef.current) {
      return;
    }
    this.onClose();
  };

  private readonly onObjectClick = (
    event: React.MouseEvent<HTMLButtonElement | HTMLImageElement>
  ) => {
    event.stopPropagation();
    this.onClose();
  };
}
