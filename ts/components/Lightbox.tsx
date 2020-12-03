// tslint:disable:react-a11y-anchors

import React from 'react';

import classNames from 'classnames';
import is from '@sindresorhus/is';

import * as GoogleChrome from '../util/GoogleChrome';
import * as MIME from '../types/MIME';
import {
  SessionIconButton,
  SessionIconSize,
  SessionIconType,
} from './session/icon';
import { Flex } from './session/Flex';
import { DefaultTheme } from 'styled-components';

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
  objectURL: string;
  caption?: string;
  onNext?: () => void;
  onPrevious?: () => void;
  onSave?: () => void;
  theme: DefaultTheme;
}

const CONTROLS_WIDTH = 50;
const CONTROLS_SPACING = 10;

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    width: '100vw',
    height: '100vh',
    left: 0,
    zIndex: 5,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  } as React.CSSProperties,
  mainContainer: {
    display: 'flex',
    flexDirection: 'row',
    flexGrow: 1,
    paddingTop: 40,
    paddingLeft: 40,
    paddingRight: 40,
    paddingBottom: 0,
    minHeight: 0,
    overflow: 'hidden',
    minWidth: 0,
  } as React.CSSProperties,
  objectContainer: {
    position: 'relative',
    flexGrow: 1,
    display: 'inline-flex',
    justifyContent: 'center',
  } as React.CSSProperties,
  objectParentContainer: {
    flexGrow: 1,
    textAlign: 'center' as 'center',
    margin: 'auto',
  },
  object: {
    flexGrow: 1,
    flexShrink: 0,
    maxWidth: '80vw',
    maxHeight: '80vh',
    objectFit: 'contain',
  } as React.CSSProperties,
  caption: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'black',
    padding: '1em',
    paddingLeft: '3em',
    paddingRight: '3em',
    backgroundColor: 'rgba(192, 192, 192, .40)',
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
  theme: DefaultTheme;
}

const IconButton = ({ onClick, style, type, theme }: IconButtonProps) => {
  const clickHandler = (event: React.MouseEvent<HTMLAnchorElement>): void => {
    if (!onClick) {
      return;
    }
    onClick();
  };
  let iconRotation = 0;
  let iconType = SessionIconType.Chevron;
  switch (type) {
    case 'next':
      iconRotation = 270;
      break;
    case 'previous':
      iconRotation = 90;
      break;
    case 'close':
      iconType = SessionIconType.Exit;
      break;
    case 'save':
      iconType = SessionIconType.Upload;
      iconRotation = 180;

      break;
    default:
      throw new TypeError(`Invalid button type: ${type}`);
  }

  return (
    <SessionIconButton
      iconType={iconType}
      iconSize={SessionIconSize.Huge}
      iconRotation={iconRotation}
      // the lightbox has a dark background
      iconColor="white"
      onClick={clickHandler}
      theme={theme}
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
          <div style={styles.objectParentContainer}>
            <div style={styles.objectContainer}>
              {!is.undefined(contentType)
                ? this.renderObject({ objectURL, contentType })
                : null}
              {caption ? <div style={styles.caption}>{caption}</div> : null}
            </div>
          </div>
          <div style={styles.controls}>
            <Flex flexGrow={1}>
              <IconButton
                type="close"
                onClick={this.onClose}
                theme={this.props.theme}
              />
            </Flex>

            {onSave ? (
              <IconButton
                type="save"
                onClick={onSave}
                style={styles.saveButton}
                theme={this.props.theme}
              />
            ) : null}
          </div>
        </div>
        <div style={styles.navigationContainer}>
          {onPrevious ? (
            <IconButton
              type="previous"
              onClick={onPrevious}
              theme={this.props.theme}
            />
          ) : (
            <IconButtonPlaceholder />
          )}
          {onNext ? (
            <IconButton type="next" onClick={onNext} theme={this.props.theme} />
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
  }: {
    objectURL: string;
    contentType: MIME.MIMEType;
  }) => {
    const isImageTypeSupported = GoogleChrome.isImageTypeSupported(contentType);
    if (isImageTypeSupported) {
      return (
        <img
          alt={window.i18n('lightboxImageAlt')}
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

  private readonly onObjectClick = (event: any) => {
    event.stopPropagation();
    this.onClose();
  };
}
