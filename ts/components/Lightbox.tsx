// tslint:disable:react-a11y-anchors

import React from 'react';

import classNames from 'classnames';
import is from '@sindresorhus/is';

import * as GoogleChrome from '../util/GoogleChrome';
import * as MIME from '../types/MIME';

import { LocalizerType } from '../types/Util';

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
  i18n: LocalizerType;
  objectURL: string;
  caption?: string;
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
  private readonly containerRef: React.RefObject<HTMLDivElement>;
  private readonly videoRef: React.RefObject<HTMLVideoElement>;
  private readonly playVideoBound: () => void;

  constructor(props: Props) {
    super(props);

    this.playVideoBound = this.playVideo.bind(this);

    this.videoRef = React.createRef();
    this.containerRef = React.createRef();
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

  public playVideo() {
    if (!this.videoRef) {
      return;
    }

    const { current } = this.videoRef;
    if (!current) {
      return;
    }

    if (current.paused) {
      // tslint:disable-next-line no-floating-promises
      current.play();
    } else {
      current.pause();
    }
  }

  public render() {
    const {
      caption,
      contentType,
      i18n,
      objectURL,
      onNext,
      onPrevious,
      onSave,
    } = this.props;

    return (
      <div
        style={styles.container}
        onClick={this.onContainerClick}
        ref={this.containerRef}
        role="dialog"
      >
        <div style={styles.mainContainer}>
          <div style={styles.controlsOffsetPlaceholder} />
          <div style={styles.objectContainer}>
            {!is.undefined(contentType)
              ? this.renderObject({ objectURL, contentType, i18n })
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

  private readonly renderObject = ({
    objectURL,
    contentType,
    i18n,
  }: {
    objectURL: string;
    contentType: MIME.MIMEType;
    i18n: LocalizerType;
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
          ref={this.videoRef}
          onClick={this.playVideoBound}
          controls={true}
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

  private readonly onKeyUp = (event: KeyboardEvent) => {
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

  private readonly onContainerClick = (
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    if (this.containerRef && event.target !== this.containerRef.current) {
      return;
    }
    this.onClose();
  };

  private readonly onObjectClick = (
    event: React.MouseEvent<HTMLImageElement | HTMLDivElement>
  ) => {
    event.stopPropagation();
    this.onClose();
  };
}
