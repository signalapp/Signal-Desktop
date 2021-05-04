// tslint:disable:react-a11y-anchors

import React, { useEffect, useRef } from 'react';

import is from '@sindresorhus/is';

import * as GoogleChrome from '../util/GoogleChrome';
import * as MIME from '../types/MIME';
import { SessionIconButton, SessionIconSize, SessionIconType } from './session/icon';
import { Flex } from './basic/Flex';
import { DefaultTheme } from 'styled-components';
// useCss has some issues on our setup. so import it directly
// tslint:disable-next-line: no-submodule-imports
import useUnmount from 'react-use/lib/useUnmount';
import { useEncryptedFileFetch } from '../hooks/useEncryptedFileFetch';
import { darkTheme } from '../state/ducks/SessionTheme';

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

type Props = {
  close: () => void;
  contentType: MIME.MIMEType | undefined;
  objectURL: string;
  caption?: string;
  onNext?: () => void;
  onPrevious?: () => void;
  onSave?: () => void;
};

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

const IconButton = ({ onClick, type, theme }: IconButtonProps) => {
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

const IconButtonPlaceholder = () => <div style={styles.iconButtonPlaceholder} />;

const Icon = ({
  onClick,
  url,
}: {
  onClick?: (event: React.MouseEvent<HTMLImageElement | HTMLDivElement>) => void;
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

export const LightboxObject = ({
  objectURL,
  contentType,
  videoRef,
  onObjectClick,
}: {
  objectURL: string;
  contentType: MIME.MIMEType;
  videoRef: React.MutableRefObject<any>;
  onObjectClick: (event: any) => any;
}) => {
  const { urlToLoad } = useEncryptedFileFetch(objectURL, contentType);

  const isImageTypeSupported = GoogleChrome.isImageTypeSupported(contentType);

  const playVideo = () => {
    if (!videoRef) {
      return;
    }

    const { current } = videoRef;
    if (!current) {
      return;
    }

    if (current.paused) {
      void current.play();
    } else {
      current.pause();
    }
  };

  const pauseVideo = () => {
    if (!videoRef) {
      return;
    }

    const { current } = videoRef;
    if (current) {
      current.pause();
    }
  };

  // auto play video on showing a video attachment
  useUnmount(() => {
    pauseVideo();
  });

  if (isImageTypeSupported) {
    return <img style={styles.object} alt={window.i18n('lightboxImageAlt')} src={urlToLoad} />;
  }

  const isVideoTypeSupported = GoogleChrome.isVideoTypeSupported(contentType);
  if (isVideoTypeSupported) {
    if (urlToLoad) {
      playVideo();
    }
    return (
      <video
        role="button"
        ref={videoRef}
        onClick={playVideo}
        controls={true}
        style={styles.object}
        key={urlToLoad}
      >
        <source src={urlToLoad} />
      </video>
    );
  }

  const isUnsupportedImageType = !isImageTypeSupported && MIME.isImage(contentType);
  const isUnsupportedVideoType = !isVideoTypeSupported && MIME.isVideo(contentType);
  if (isUnsupportedImageType || isUnsupportedVideoType) {
    const iconUrl = isUnsupportedVideoType ? 'images/video.svg' : 'images/image.svg';

    return <Icon url={iconUrl} onClick={onObjectClick} />;
  }

  // tslint:disable-next-line no-console
  console.log('Lightbox: Unexpected content type', { contentType });

  return <Icon onClick={onObjectClick} url="images/file.svg" />;
};

export const Lightbox = (props: Props) => {
  const videoRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // there is no theme in use on the lightbox
  const theme = darkTheme;
  const { caption, contentType, objectURL, onNext, onPrevious, onSave } = props;

  const onObjectClick = (event: any) => {
    event.stopPropagation();
    props.close?.();
  };

  const onContainerClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (containerRef && event.target !== containerRef.current) {
      return;
    }
    props.close?.();
  };

  return (
    <div style={styles.container} role="dialog">
      <div style={styles.mainContainer}>
        <div style={styles.controlsOffsetPlaceholder} />
        <div
          style={styles.objectParentContainer}
          onClick={onContainerClick}
          ref={containerRef}
          role="button"
        >
          <div style={styles.objectContainer}>
            {!is.undefined(contentType) ? (
              <LightboxObject
                objectURL={objectURL}
                contentType={contentType}
                videoRef={videoRef}
                onObjectClick={onObjectClick}
              />
            ) : null}
            {caption ? <div style={styles.caption}>{caption}</div> : null}
          </div>
        </div>
        <div style={styles.controls}>
          <Flex flex="1 1 auto">
            <IconButton
              type="close"
              onClick={() => {
                props.close?.();
              }}
              theme={theme}
            />
          </Flex>

          {onSave ? (
            <IconButton type="save" onClick={onSave} style={styles.saveButton} theme={theme} />
          ) : null}
        </div>
      </div>
      <div style={styles.navigationContainer}>
        {onPrevious ? (
          <IconButton type="previous" onClick={onPrevious} theme={theme} />
        ) : (
          <IconButtonPlaceholder />
        )}
        {onNext ? (
          <IconButton type="next" onClick={onNext} theme={theme} />
        ) : (
          <IconButtonPlaceholder />
        )}
      </div>
    </div>
  );
};
