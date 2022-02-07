// tslint:disable:react-a11y-anchors

import React, { useRef } from 'react';

// useCss has some issues on our setup. so import it directly
// tslint:disable-next-line: no-submodule-imports
import useUnmount from 'react-use/lib/useUnmount';
import { useDispatch } from 'react-redux';
import { useDisableDrag } from '../../hooks/useDisableDrag';
import { useEncryptedFileFetch } from '../../hooks/useEncryptedFileFetch';
import { showLightBox } from '../../state/ducks/conversations';
import { GoogleChrome } from '../../util';
import { Flex } from '../basic/Flex';
import { SessionIconButton, SessionIconType } from '../icon';
import * as MIME from '../../types/MIME';
import { isUndefined } from 'lodash';

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
}

const IconButton = ({ onClick, type }: IconButtonProps) => {
  const clickHandler = (): void => {
    if (!onClick) {
      return;
    }
    onClick();
  };
  let iconRotation = 0;
  let iconType: SessionIconType = 'chevron';
  switch (type) {
    case 'next':
      iconRotation = 270;
      break;
    case 'previous':
      iconRotation = 90;
      break;
    case 'close':
      iconType = 'exit';
      break;
    case 'save':
      iconType = 'upload';
      iconRotation = 180;

      break;
    default:
      throw new TypeError(`Invalid button type: ${type}`);
  }

  return (
    <SessionIconButton
      iconType={iconType}
      iconSize={'huge'}
      iconRotation={iconRotation}
      // the lightbox has a dark background
      iconColor="white"
      onClick={clickHandler}
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
      ...(styles.object as any),
      ...colorSVG(url, Colors.ICON_SECONDARY),
      maxWidth: 200,
    }}
    onClick={onClick}
    role="button"
  />
);

// tslint:disable-next-line: max-func-body-length
export const LightboxObject = ({
  objectURL,
  contentType,
  renderedRef,
  onObjectClick,
}: {
  objectURL: string;
  contentType: MIME.MIMEType;
  renderedRef: React.MutableRefObject<any>;
  onObjectClick: (event: any) => any;
}) => {
  const { urlToLoad } = useEncryptedFileFetch(objectURL, contentType, false);

  const isImageTypeSupported = GoogleChrome.isImageTypeSupported(contentType);

  // auto play video on showing a video attachment
  useUnmount(() => {
    if (!renderedRef?.current) {
      return;
    }
    renderedRef.current.pause.pause();
  });
  const disableDrag = useDisableDrag();

  if (isImageTypeSupported) {
    return (
      <img
        style={styles.object as any}
        onDragStart={disableDrag}
        alt={window.i18n('lightboxImageAlt')}
        src={urlToLoad}
        ref={renderedRef}
      />
    );
  }

  const isVideoTypeSupported = GoogleChrome.isVideoTypeSupported(contentType);
  if (isVideoTypeSupported) {
    if (urlToLoad) {
      if (renderedRef?.current?.paused) {
        void renderedRef?.current?.play();
      }
    }

    return (
      <video
        role="button"
        ref={renderedRef}
        controls={true}
        style={styles.object as any}
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
  const renderedRef = useRef<any>(null);
  const dispatch = useDispatch();
  const { caption, contentType, objectURL, onNext, onPrevious, onSave } = props;

  const onObjectClick = (event: any) => {
    event.stopPropagation();
    dispatch(showLightBox(undefined));
  };

  const onContainerClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (renderedRef && event.target === renderedRef.current) {
      return;
    }
    dispatch(showLightBox(undefined));
  };

  return (
    <div style={styles.container as any} role="dialog" onClick={onContainerClick}>
      <div style={styles.mainContainer as any}>
        <div style={styles.controlsOffsetPlaceholder} />
        <div style={styles.objectParentContainer} role="button">
          <div style={styles.objectContainer as any}>
            {!isUndefined(contentType) ? (
              <LightboxObject
                objectURL={objectURL}
                contentType={contentType}
                renderedRef={renderedRef}
                onObjectClick={onObjectClick}
              />
            ) : null}
            {caption ? <div style={styles.caption as any}>{caption}</div> : null}
          </div>
        </div>
        <div style={styles.controls as any}>
          <Flex flex="1 1 auto">
            <IconButton
              type="close"
              onClick={() => {
                dispatch(showLightBox(undefined));
              }}
            />
          </Flex>

          {onSave ? <IconButton type="save" onClick={onSave} style={styles.saveButton} /> : null}
        </div>
      </div>
      <div style={styles.navigationContainer as any}>
        {onPrevious ? (
          <IconButton type="previous" onClick={onPrevious} />
        ) : (
          <IconButtonPlaceholder />
        )}
        {onNext ? <IconButton type="next" onClick={onNext} /> : <IconButtonPlaceholder />}
      </div>
    </div>
  );
};
