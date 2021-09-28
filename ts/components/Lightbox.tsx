// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, {
  CSSProperties,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import classNames from 'classnames';
import moment from 'moment';
import { createPortal } from 'react-dom';
import { noop } from 'lodash';

import * as GoogleChrome from '../util/GoogleChrome';
import { AttachmentType, isGIF } from '../types/Attachment';
import { Avatar, AvatarSize } from './Avatar';
import { ConversationType } from '../state/ducks/conversations';
import { IMAGE_PNG, isImage, isVideo } from '../types/MIME';
import { LocalizerType } from '../types/Util';
import { MediaItemType, MessageAttributesType } from '../types/MediaItem';
import { formatDuration } from '../util/formatDuration';
import { useRestoreFocus } from '../hooks/useRestoreFocus';
import * as log from '../logging/log';

export type PropsType = {
  children?: ReactNode;
  close: () => void;
  getConversation?: (id: string) => ConversationType;
  i18n: LocalizerType;
  isViewOnce?: boolean;
  media: Array<MediaItemType>;
  onForward?: (messageId: string) => void;
  onSave?: (options: {
    attachment: AttachmentType;
    message: MessageAttributesType;
    index: number;
  }) => void;
  selectedIndex?: number;
};

enum ZoomType {
  None,
  FillScreen,
  ZoomAndPan,
}

export function Lightbox({
  children,
  close,
  getConversation,
  media,
  i18n,
  isViewOnce = false,
  onForward,
  onSave,
  selectedIndex: initialSelectedIndex = 0,
}: PropsType): JSX.Element | null {
  const [root, setRoot] = React.useState<HTMLElement | undefined>();
  const [selectedIndex, setSelectedIndex] = useState<number>(
    initialSelectedIndex
  );

  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(
    null
  );
  const [videoTime, setVideoTime] = useState<number | undefined>();
  const [zoomType, setZoomType] = useState<ZoomType>(ZoomType.None);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [focusRef] = useRestoreFocus();
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imagePanStyle, setImagePanStyle] = useState<CSSProperties>({});
  const zoomCoordsRef = useRef<
    | { screenWidth: number; screenHeight: number; x: number; y: number }
    | undefined
  >();

  const onPrevious = useCallback(
    (
      event: KeyboardEvent | React.MouseEvent<HTMLButtonElement, MouseEvent>
    ) => {
      event.preventDefault();
      event.stopPropagation();

      setSelectedIndex(prevSelectedIndex => Math.max(prevSelectedIndex - 1, 0));
    },
    []
  );

  const onNext = useCallback(
    (
      event: KeyboardEvent | React.MouseEvent<HTMLButtonElement, MouseEvent>
    ) => {
      event.preventDefault();
      event.stopPropagation();

      setSelectedIndex(prevSelectedIndex =>
        Math.min(prevSelectedIndex + 1, media.length - 1)
      );
    },
    [media]
  );

  const onTimeUpdate = useCallback(() => {
    if (!videoElement) {
      return;
    }
    setVideoTime(videoElement.currentTime);
  }, [setVideoTime, videoElement]);

  const handleSave = (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    event.stopPropagation();
    event.preventDefault();

    const mediaItem = media[selectedIndex];
    const { attachment, message, index } = mediaItem;

    onSave?.({ attachment, message, index });
  };

  const handleForward = (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    event.preventDefault();
    event.stopPropagation();

    close();
    const mediaItem = media[selectedIndex];
    onForward?.(mediaItem.message.id);
  };

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Escape': {
          close();

          event.preventDefault();
          event.stopPropagation();

          break;
        }

        case 'ArrowLeft':
          onPrevious(event);
          break;

        case 'ArrowRight':
          onNext(event);
          break;

        default:
      }
    },
    [close, onNext, onPrevious]
  );

  const onClose = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    event.preventDefault();

    close();
  };

  const playVideo = useCallback(() => {
    if (!videoElement) {
      return;
    }

    if (videoElement.paused) {
      videoElement.play();
    } else {
      videoElement.pause();
    }
  }, [videoElement]);

  useEffect(() => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    setRoot(div);

    return () => {
      document.body.removeChild(div);
      setRoot(undefined);
    };
  }, []);

  useEffect(() => {
    const useCapture = true;
    document.addEventListener('keydown', onKeyDown, useCapture);

    return () => {
      document.removeEventListener('keydown', onKeyDown, useCapture);
    };
  }, [onKeyDown]);

  const { attachment, contentType, loop = false, objectURL, message } =
    media[selectedIndex] || {};

  const isAttachmentGIF = isGIF(attachment ? [attachment] : undefined);

  useEffect(() => {
    playVideo();

    if (!videoElement || !isViewOnce) {
      return noop;
    }

    if (isAttachmentGIF) {
      return noop;
    }

    videoElement.addEventListener('timeupdate', onTimeUpdate);

    return () => {
      videoElement.removeEventListener('timeupdate', onTimeUpdate);
    };
  }, [isViewOnce, isAttachmentGIF, onTimeUpdate, playVideo, videoElement]);

  const positionImage = useCallback((ev?: MouseEvent) => {
    const imageNode = imageRef.current;
    const zoomCoords = zoomCoordsRef.current;
    if (!imageNode || !zoomCoords) {
      return;
    }

    if (ev) {
      zoomCoords.x = ev.clientX;
      zoomCoords.y = ev.clientY;
    }

    const scaleX =
      (-1 / zoomCoords.screenWidth) *
      (imageNode.offsetWidth - zoomCoords.screenWidth);
    const scaleY =
      (-1 / zoomCoords.screenHeight) *
      (imageNode.offsetHeight - zoomCoords.screenHeight);

    setImagePanStyle({
      transform: `translate(${zoomCoords.x * scaleX}px, ${
        zoomCoords.y * scaleY
      }px)`,
    });
  }, []);

  function canPanImage(): boolean {
    const imageNode = imageRef.current;

    return Boolean(
      imageNode &&
        (imageNode.naturalWidth > document.documentElement.clientWidth ||
          imageNode.naturalHeight > document.documentElement.clientHeight)
    );
  }

  useEffect(() => {
    const imageNode = imageRef.current;
    let hasListener = false;

    if (imageNode && zoomType !== ZoomType.None && canPanImage()) {
      hasListener = true;
      document.addEventListener('mousemove', positionImage);
    }

    return () => {
      if (hasListener) {
        document.removeEventListener('mousemove', positionImage);
      }
    };
  }, [positionImage, zoomType]);

  const caption = attachment?.caption;

  let content: JSX.Element;
  let shadowImage: JSX.Element | undefined;
  if (!contentType) {
    content = <>{children}</>;
  } else {
    const isImageTypeSupported = GoogleChrome.isImageTypeSupported(contentType);
    const isVideoTypeSupported = GoogleChrome.isVideoTypeSupported(contentType);
    const isUnsupportedImageType =
      !isImageTypeSupported && isImage(contentType);
    const isUnsupportedVideoType =
      !isVideoTypeSupported && isVideo(contentType);

    if (isImageTypeSupported) {
      if (objectURL) {
        shadowImage = (
          <div className="Lightbox__shadow-container">
            <div className="Lightbox__object--container">
              <img
                alt={i18n('lightboxImageAlt')}
                className="Lightbox__object"
                ref={imageRef}
                src={objectURL}
                tabIndex={-1}
              />
            </div>
          </div>
        );
        content = (
          <button
            className="Lightbox__zoom-button"
            onClick={(
              event: React.MouseEvent<HTMLButtonElement, MouseEvent>
            ) => {
              event.preventDefault();
              event.stopPropagation();

              if (zoomType === ZoomType.None) {
                if (canPanImage()) {
                  setZoomType(ZoomType.ZoomAndPan);
                  zoomCoordsRef.current = {
                    screenWidth: document.documentElement.clientWidth,
                    screenHeight: document.documentElement.clientHeight,
                    x: event.clientX,
                    y: event.clientY,
                  };
                  positionImage();
                } else {
                  setZoomType(ZoomType.FillScreen);
                }
              } else {
                setZoomType(ZoomType.None);
              }
            }}
            type="button"
          >
            <img
              alt={i18n('lightboxImageAlt')}
              className="Lightbox__object"
              onContextMenu={(event: React.MouseEvent<HTMLImageElement>) => {
                // These are the only image types supported by Electron's NativeImage
                if (
                  event &&
                  contentType !== IMAGE_PNG &&
                  !/image\/jpe?g/g.test(contentType)
                ) {
                  event.preventDefault();
                }
              }}
              src={objectURL}
              style={zoomType === ZoomType.ZoomAndPan ? imagePanStyle : {}}
            />
          </button>
        );
      } else {
        content = (
          <button
            aria-label={i18n('lightboxImageAlt')}
            className={classNames({
              Lightbox__object: true,
              Lightbox__unsupported: true,
              'Lightbox__unsupported--missing': true,
            })}
            onClick={onClose}
            type="button"
          />
        );
      }
    } else if (isVideoTypeSupported) {
      const shouldLoop = loop || isAttachmentGIF || isViewOnce;

      content = (
        <video
          className="Lightbox__object"
          controls={!shouldLoop}
          key={objectURL}
          loop={shouldLoop}
          ref={setVideoElement}
        >
          <source src={objectURL} />
        </video>
      );
    } else if (isUnsupportedImageType || isUnsupportedVideoType) {
      content = (
        <button
          aria-label={i18n('unsupportedAttachment')}
          className={classNames({
            Lightbox__object: true,
            Lightbox__unsupported: true,
            'Lightbox__unsupported--image': isUnsupportedImageType,
            'Lightbox__unsupported--video': isUnsupportedVideoType,
          })}
          onClick={onClose}
          type="button"
        />
      );
    } else {
      log.info('Lightbox: Unexpected content type', { contentType });

      content = (
        <button
          aria-label={i18n('unsupportedAttachment')}
          className="Lightbox__object Lightbox__unsupported Lightbox__unsupported--file"
          onClick={onClose}
          type="button"
        />
      );
    }
  }

  const isZoomed = zoomType !== ZoomType.None;

  const hasNext = isZoomed && selectedIndex < media.length - 1;
  const hasPrevious = isZoomed && selectedIndex > 0;

  return root
    ? createPortal(
        <div
          className="Lightbox Lightbox__container"
          onClick={(event: React.MouseEvent<HTMLDivElement>) => {
            event.stopPropagation();
            event.preventDefault();

            close();
          }}
          onKeyUp={(event: React.KeyboardEvent<HTMLDivElement>) => {
            if (
              (containerRef && event.target !== containerRef.current) ||
              event.keyCode !== 27
            ) {
              return;
            }

            close();
          }}
          ref={containerRef}
          role="presentation"
        >
          <div
            className="Lightbox__main-container"
            tabIndex={-1}
            ref={focusRef}
          >
            {!isZoomed && (
              <div className="Lightbox__header">
                {getConversation ? (
                  <LightboxHeader
                    getConversation={getConversation}
                    i18n={i18n}
                    message={message}
                  />
                ) : (
                  <div />
                )}
                <div className="Lightbox__controls">
                  {onForward ? (
                    <button
                      aria-label={i18n('forwardMessage')}
                      className="Lightbox__button Lightbox__button--forward"
                      onClick={handleForward}
                      type="button"
                    />
                  ) : null}
                  {onSave ? (
                    <button
                      aria-label={i18n('save')}
                      className="Lightbox__button Lightbox__button--save"
                      onClick={handleSave}
                      type="button"
                    />
                  ) : null}
                  <button
                    aria-label={i18n('close')}
                    className="Lightbox__button Lightbox__button--close"
                    onClick={close}
                    type="button"
                  />
                </div>
              </div>
            )}
            <div
              className={classNames('Lightbox__object--container', {
                'Lightbox__object--container--fill':
                  zoomType === ZoomType.FillScreen,
                'Lightbox__object--container--zoom':
                  zoomType === ZoomType.ZoomAndPan,
              })}
            >
              {content}
            </div>
            {shadowImage}
            {hasPrevious && (
              <div className="Lightbox__nav-prev">
                <button
                  aria-label={i18n('previous')}
                  className="Lightbox__button Lightbox__button--previous"
                  onClick={onPrevious}
                  type="button"
                />
              </div>
            )}
            {hasNext && (
              <div className="Lightbox__nav-next">
                <button
                  aria-label={i18n('next')}
                  className="Lightbox__button Lightbox__button--next"
                  onClick={onNext}
                  type="button"
                />
              </div>
            )}
          </div>
          {!isZoomed && (
            <div className="Lightbox__footer">
              {isViewOnce && videoTime ? (
                <div className="Lightbox__timestamp">
                  {formatDuration(videoTime)}
                </div>
              ) : null}
              {caption ? (
                <div className="Lightbox__caption">{caption}</div>
              ) : null}
              {media.length > 1 && (
                <div className="Lightbox__thumbnails--container">
                  <div
                    className="Lightbox__thumbnails"
                    style={{
                      marginLeft:
                        0 - (selectedIndex * 64 + selectedIndex * 8 + 32),
                    }}
                  >
                    {media.map((item, index) => (
                      <button
                        className={classNames({
                          Lightbox__thumbnail: true,
                          'Lightbox__thumbnail--selected':
                            index === selectedIndex,
                        })}
                        key={item.thumbnailObjectUrl}
                        type="button"
                        onClick={(
                          event: React.MouseEvent<HTMLButtonElement, MouseEvent>
                        ) => {
                          event.stopPropagation();
                          event.preventDefault();

                          setSelectedIndex(index);
                        }}
                      >
                        {item.thumbnailObjectUrl ? (
                          <img
                            alt={i18n('lightboxImageAlt')}
                            src={item.thumbnailObjectUrl}
                          />
                        ) : (
                          <div className="Lightbox__thumbnail--unavailable" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>,
        root
      )
    : null;
}

function LightboxHeader({
  getConversation,
  i18n,
  message,
}: {
  getConversation: (id: string) => ConversationType;
  i18n: LocalizerType;
  message: MessageAttributesType;
}): JSX.Element {
  const conversation = getConversation(message.conversationId);

  return (
    <div className="Lightbox__header--container">
      <div className="Lightbox__header--avatar">
        <Avatar
          acceptedMessageRequest={conversation.acceptedMessageRequest}
          avatarPath={conversation.avatarPath}
          color={conversation.color}
          conversationType={conversation.type}
          i18n={i18n}
          isMe={conversation.isMe}
          name={conversation.name}
          phoneNumber={conversation.e164}
          profileName={conversation.profileName}
          sharedGroupNames={conversation.sharedGroupNames}
          size={AvatarSize.THIRTY_TWO}
          title={conversation.title}
          unblurredAvatarPath={conversation.unblurredAvatarPath}
        />
      </div>
      <div className="Lightbox__header--content">
        <div className="Lightbox__header--name">{conversation.title}</div>
        <div className="Lightbox__header--timestamp">
          {moment(message.received_at_ms).format('L LT')}
        </div>
      </div>
    </div>
  );
}
