// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

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

export type Props = {
  close: () => void;
  contentType: MIME.MIMEType | undefined;
  i18n: LocalizerType;
  objectURL: string;
  caption?: string;
  isViewOnce: boolean;
  onNext?: () => void;
  onPrevious?: () => void;
  onSave?: () => void;
};
type State = {
  videoTime?: number;
  fadeout: boolean;
};

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
  buttonContainer: {
    backgroundColor: 'transparent',
    border: 'none',
    display: 'flex',
    flexDirection: 'column',
    outline: 'none',
    width: '100%',
    padding: 0,
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
    flexShrink: 1,
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
    outline: 'none',
  } as React.CSSProperties,
  img: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: 'auto',
    height: 'auto',
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
    textAlign: 'center' as const,
    padding: '6px',
    paddingLeft: '18px',
    paddingRight: '18px',
  },
};

type IconButtonProps = {
  i18n: LocalizerType;
  onClick?: () => void;
  style?: React.CSSProperties;
  type: 'save' | 'close' | 'previous' | 'next';
};

const IconButton = ({ i18n, onClick, style, type }: IconButtonProps) => {
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
      aria-label={i18n(type)}
      type="button"
    />
  );
};

const IconButtonPlaceholder = () => (
  <div style={styles.iconButtonPlaceholder} />
);

const Icon = ({
  i18n,
  onClick,
  url,
}: {
  i18n: LocalizerType;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  url: string;
}) => (
  <button
    style={{
      ...styles.object,
      ...colorSVG(url, Colors.ICON_SECONDARY),
      maxWidth: 200,
    }}
    onClick={onClick}
    aria-label={i18n('unsupportedAttachment')}
    type="button"
  />
);

export class Lightbox extends React.Component<Props, State> {
  public readonly containerRef = React.createRef<HTMLDivElement>();

  public readonly videoRef = React.createRef<HTMLVideoElement>();

  public readonly focusRef = React.createRef<HTMLDivElement>();

  public previousFocus: HTMLElement | null = null;

  public constructor(props: Props) {
    super(props);

    this.state = {
      fadeout: false,
    };
  }

  public componentDidMount(): void {
    this.previousFocus = document.activeElement as HTMLElement;

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

  public componentWillUnmount(): void {
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

  public getVideo(): HTMLVideoElement | null {
    if (!this.videoRef) {
      return null;
    }

    const { current } = this.videoRef;
    if (!current) {
      return null;
    }

    return current;
  }

  public playVideo(): void {
    const video = this.getVideo();
    if (!video) {
      return;
    }

    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  }

  public render(): JSX.Element {
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
    const { videoTime, fadeout } = this.state;

    return (
      <div
        className={classNames('module-lightbox', fadeout ? 'fadeout' : null)}
        style={styles.container}
        onClick={this.onContainerClick}
        onKeyUp={this.onContainerKeyUp}
        ref={this.containerRef}
        role="presentation"
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
            <IconButton i18n={i18n} type="close" onClick={this.onClose} />
            {onSave ? (
              <IconButton
                i18n={i18n}
                type="save"
                onClick={onSave}
                style={styles.saveButton}
              />
            ) : null}
          </div>
        </div>
        {isViewOnce && videoTime && is.number(videoTime) ? (
          <div style={styles.navigationContainer}>
            <div style={styles.timestampPill}>{formatDuration(videoTime)}</div>
          </div>
        ) : (
          <div style={styles.navigationContainer}>
            {onPrevious ? (
              <IconButton i18n={i18n} type="previous" onClick={onPrevious} />
            ) : (
              <IconButtonPlaceholder />
            )}
            {onNext ? (
              <IconButton i18n={i18n} type="next" onClick={onNext} />
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
        <button
          type="button"
          style={styles.buttonContainer}
          onClick={this.onObjectClick}
        >
          <img
            alt={i18n('lightboxImageAlt')}
            style={styles.img}
            src={objectURL}
            onContextMenu={this.onContextMenu}
          />
        </button>
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
        ? 'images/movie.svg'
        : 'images/image.svg';

      return <Icon i18n={i18n} url={iconUrl} onClick={this.onObjectClick} />;
    }

    window.log.info('Lightbox: Unexpected content type', { contentType });

    return (
      <Icon i18n={i18n} onClick={this.onObjectClick} url="images/file.svg" />
    );
  };

  private readonly onContextMenu = (
    event: React.MouseEvent<HTMLImageElement>
  ) => {
    const { contentType = '' } = this.props;

    // These are the only image types supported by Electron's NativeImage
    if (
      event &&
      contentType !== 'image/png' &&
      !/image\/jpe?g/g.test(contentType)
    ) {
      event.preventDefault();
    }
  };

  private readonly onClose = () => {
    const { close } = this.props;
    if (!close) {
      return;
    }
    this.setState({
      fadeout: true,
    });
    setTimeout(() => {
      close();
    }, 150);
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

  private readonly onContainerKeyUp = (
    event: React.KeyboardEvent<HTMLDivElement>
  ) => {
    if (
      (this.containerRef && event.target !== this.containerRef.current) ||
      event.keyCode !== 27
    ) {
      return;
    }

    this.onClose();
  };

  private readonly onObjectClick = (
    event: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>
  ) => {
    event.stopPropagation();
    this.onClose();
  };
}
