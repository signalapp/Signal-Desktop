// tslint:disable:react-a11y-anchors

import React from 'react';

import classNames from 'classnames';
import is from '@sindresorhus/is';

import * as GoogleChrome from '../util/GoogleChrome';
import * as MIME from '../types/MIME';

import { Localizer } from '../types/Util';

const Colors = {
  TEXT_SECONDARY: '#bbb',
  ICON_SECONDARY: '#ccc',
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
  i18n: Localizer;
  objectURL: string;
  onNext?: () => void;
  onPrevious?: () => void;
  onSave?: () => void;
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
  } as React.CSSProperties,
  objectContainer: {
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
  iconButtonPlaceholder: {
    // Dimensions match `.iconButton`:
    display: 'inline-block',
    width: 50,
    height: 50,
  },
};

interface IconButtonProps {
  onClick?: () => void;
  style?: React.CSSProperties;
  type: 'save' | 'close' | 'previous' | 'next';
}

const IconButton = ({ onClick, style, type }: IconButtonProps) => {
  const clickHandler = (event: React.MouseEvent<HTMLAnchorElement>): void => {
    event.preventDefault();
    if (!onClick) {
      return;
    }

    onClick();
  };

  return (
    <a
      href="#"
      onClick={clickHandler}
      className={classNames('iconButton', type)}
      role="button"
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
  onClick?: (
    event: React.MouseEvent<HTMLImageElement | HTMLDivElement>
  ) => void;
  url: string;
}) => (
  <div
    style={{
      ...styles.object,
      ...colorSVG(url, Colors.ICON_SECONDARY),
      maxWidth: 200,
    }}
    onClick={onClick}
    role="button"
  />
);

export class Lightbox extends React.Component<Props> {
  private containerRef: HTMLDivElement | null = null;
  private videoRef: HTMLVideoElement | null = null;

  private captureVideoBound: (element: HTMLVideoElement) => void;
  private playVideoBound: () => void;

  constructor(props: Props) {
    super(props);

    this.captureVideoBound = this.captureVideo.bind(this);
    this.playVideoBound = this.playVideo.bind(this);
  }

  public componentDidMount() {
    const useCapture = true;
    document.addEventListener('keyup', this.onKeyUp, useCapture);

    this.playVideo();
  }

  public componentWillUnmount() {
    const useCapture = true;
    document.removeEventListener('keyup', this.onKeyUp, useCapture);
  }

  public captureVideo(element: HTMLVideoElement) {
    this.videoRef = element;
  }

  public playVideo() {
    if (!this.videoRef) {
      return;
    }

    if (this.videoRef.paused) {
      // tslint:disable-next-line no-floating-promises
      this.videoRef.play();
    } else {
      this.videoRef.pause();
    }
  }

  public render() {
    const {
      contentType,
      objectURL,
      onNext,
      onPrevious,
      onSave,
      i18n,
    } = this.props;

    return (
      <div
        style={styles.container}
        onClick={this.onContainerClick}
        ref={this.setContainerRef}
        role="dialog"
      >
        <div style={styles.mainContainer}>
          <div style={styles.controlsOffsetPlaceholder} />
          <div style={styles.objectContainer}>
            {!is.undefined(contentType)
              ? this.renderObject({ objectURL, contentType, i18n })
              : null}
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
      </div>
    );
  }

  private renderObject = ({
    objectURL,
    contentType,
    i18n,
  }: {
    objectURL: string;
    contentType: MIME.MIMEType;
    i18n: Localizer;
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
          role="button"
          ref={this.captureVideoBound}
          onClick={this.playVideoBound}
          controls={true}
          style={styles.object}
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
      return (
        <Icon
          url={isUnsupportedVideoType ? 'images/video.svg' : 'images/image.svg'}
          onClick={this.onObjectClick}
        />
      );
    }

    // tslint:disable-next-line no-console
    console.log('Lightbox: Unexpected content type', { contentType });

    return <Icon onClick={this.onObjectClick} url="images/file.svg" />;
  };

  private setContainerRef = (value: HTMLDivElement) => {
    this.containerRef = value;
  };

  private onClose = () => {
    const { close } = this.props;
    if (!close) {
      return;
    }

    close();
  };

  private onKeyUp = (event: KeyboardEvent) => {
    const { onNext, onPrevious } = this.props;
    switch (event.key) {
      case 'Escape':
        this.onClose();
        break;

      case 'ArrowLeft':
        if (onPrevious) {
          onPrevious();
        }
        break;

      case 'ArrowRight':
        if (onNext) {
          onNext();
        }
        break;

      default:
    }
  };

  private onContainerClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target !== this.containerRef) {
      return;
    }
    this.onClose();
  };

  private onObjectClick = (
    event: React.MouseEvent<HTMLImageElement | HTMLDivElement>
  ) => {
    event.stopPropagation();
    this.onClose();
  };
}
