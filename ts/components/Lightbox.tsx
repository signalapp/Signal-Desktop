// Copyright 2018-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import moment from 'moment';
import { createPortal } from 'react-dom';
import { noop } from 'lodash';
import { useSpring, animated, to } from '@react-spring/web';

import * as GoogleChrome from '../util/GoogleChrome';
import type { AttachmentType } from '../types/Attachment';
import { isGIF } from '../types/Attachment';
import { Avatar, AvatarSize } from './Avatar';
import type { ConversationType } from '../state/ducks/conversations';
import { IMAGE_PNG, isImage, isVideo } from '../types/MIME';
import type { LocalizerType } from '../types/Util';
import type { MediaItemType, MediaItemMessageType } from '../types/MediaItem';
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
    message: MediaItemMessageType;
    index: number;
  }) => void;
  selectedIndex?: number;
};

const ZOOM_SCALE = 3;

const INITIAL_IMAGE_TRANSFORM = {
  scale: 1,
  translateX: 0,
  translateY: 0,
  config: {
    clamp: true,
    friction: 20,
    mass: 0.5,
    tension: 350,
  },
};

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
  const [selectedIndex, setSelectedIndex] =
    useState<number>(initialSelectedIndex);

  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(
    null
  );
  const [videoTime, setVideoTime] = useState<number | undefined>();
  const [isZoomed, setIsZoomed] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [focusRef] = useRestoreFocus();
  const animateRef = useRef<HTMLDivElement | null>(null);
  const dragCacheRef = useRef<
    | {
        startX: number;
        startY: number;
        translateX: number;
        translateY: number;
      }
    | undefined
  >();
  const imageRef = useRef<HTMLImageElement | null>(null);
  const zoomCacheRef = useRef<
    | {
        maxX: number;
        maxY: number;
        screenWidth: number;
        screenHeight: number;
      }
    | undefined
  >();

  const onPrevious = useCallback(
    (
      event: KeyboardEvent | React.MouseEvent<HTMLButtonElement, MouseEvent>
    ) => {
      event.preventDefault();
      event.stopPropagation();

      if (isZoomed) {
        return;
      }

      setSelectedIndex(prevSelectedIndex => Math.max(prevSelectedIndex - 1, 0));
    },
    [isZoomed]
  );

  const onNext = useCallback(
    (
      event: KeyboardEvent | React.MouseEvent<HTMLButtonElement, MouseEvent>
    ) => {
      event.preventDefault();
      event.stopPropagation();

      if (isZoomed) {
        return;
      }

      setSelectedIndex(prevSelectedIndex =>
        Math.min(prevSelectedIndex + 1, media.length - 1)
      );
    },
    [isZoomed, media]
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

  const {
    attachment,
    contentType,
    loop = false,
    objectURL,
    message,
  } = media[selectedIndex] || {};

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

  const [{ scale, translateX, translateY }, springApi] = useSpring(
    () => INITIAL_IMAGE_TRANSFORM
  );

  const maxBoundsLimiter = useCallback(
    (x: number, y: number): [number, number] => {
      const zoomCache = zoomCacheRef.current;

      if (!zoomCache) {
        return [0, 0];
      }

      const { maxX, maxY } = zoomCache;

      const posX = Math.min(maxX, Math.max(-maxX, x));
      const posY = Math.min(maxY, Math.max(-maxY, y));

      return [posX, posY];
    },
    []
  );

  const positionImage = useCallback(
    (ev: MouseEvent) => {
      const zoomCache = zoomCacheRef.current;

      if (!zoomCache) {
        return;
      }

      const { maxX, maxY, screenWidth, screenHeight } = zoomCache;

      const shouldTranslateX = maxX * ZOOM_SCALE > screenWidth;
      const shouldTranslateY = maxY * ZOOM_SCALE > screenHeight;

      const offsetX = screenWidth / 2 - ev.clientX;
      const offsetY = screenHeight / 2 - ev.clientY;
      const posX = offsetX * ZOOM_SCALE;
      const posY = offsetY * ZOOM_SCALE;
      const [x, y] = maxBoundsLimiter(posX, posY);

      springApi.start({
        scale: ZOOM_SCALE,
        translateX: shouldTranslateX ? x : undefined,
        translateY: shouldTranslateY ? y : undefined,
      });
    },
    [maxBoundsLimiter, springApi]
  );

  const handleTouchStart = useCallback(
    (ev: TouchEvent) => {
      const [touch] = ev.touches;

      dragCacheRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        translateX: translateX.get(),
        translateY: translateY.get(),
      };
    },
    [translateY, translateX]
  );

  const handleTouchMove = useCallback(
    (ev: TouchEvent) => {
      const dragCache = dragCacheRef.current;

      if (!dragCache) {
        return;
      }

      const [touch] = ev.touches;

      const deltaX = touch.clientX - dragCache.startX;
      const deltaY = touch.clientY - dragCache.startY;

      const x = dragCache.translateX + deltaX;
      const y = dragCache.translateY + deltaY;

      springApi.start({
        scale: ZOOM_SCALE,
        translateX: x,
        translateY: y,
      });
    },
    [springApi]
  );

  const zoomButtonHandler = useCallback(
    (ev: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      ev.preventDefault();
      ev.stopPropagation();

      const imageNode = imageRef.current;
      const animateNode = animateRef.current;
      if (!imageNode || !animateNode) {
        return;
      }

      if (!isZoomed) {
        const maxX = imageNode.offsetWidth;
        const maxY = imageNode.offsetHeight;
        const screenHeight = window.innerHeight;
        const screenWidth = window.innerWidth;

        zoomCacheRef.current = {
          maxX,
          maxY,
          screenHeight,
          screenWidth,
        };

        const shouldTranslateX = maxX * ZOOM_SCALE > screenWidth;
        const shouldTranslateY = maxY * ZOOM_SCALE > screenHeight;

        const { height, left, top, width } =
          animateNode.getBoundingClientRect();

        const offsetX = ev.clientX - left - width / 2;
        const offsetY = ev.clientY - top - height / 2;
        const posX = -offsetX * ZOOM_SCALE + translateX.get();
        const posY = -offsetY * ZOOM_SCALE + translateY.get();
        const [x, y] = maxBoundsLimiter(posX, posY);

        springApi.start({
          scale: ZOOM_SCALE,
          translateX: shouldTranslateX ? x : undefined,
          translateY: shouldTranslateY ? y : undefined,
        });

        setIsZoomed(true);
      } else {
        springApi.start(INITIAL_IMAGE_TRANSFORM);
        setIsZoomed(false);
      }
    },
    [isZoomed, maxBoundsLimiter, translateX, translateY, springApi]
  );

  useEffect(() => {
    const animateNode = animateRef.current;
    let hasListener = false;

    if (animateNode && isZoomed) {
      hasListener = true;
      document.addEventListener('mousemove', positionImage);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchstart', handleTouchStart);
    }

    return () => {
      if (hasListener) {
        document.removeEventListener('mousemove', positionImage);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchstart', handleTouchStart);
      }
    };
  }, [handleTouchMove, handleTouchStart, isZoomed, positionImage]);

  const caption = attachment?.caption;

  let content: JSX.Element;
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
        content = (
          <div className="Lightbox__zoomable-container">
            <button
              className="Lightbox__zoom-button"
              onClick={zoomButtonHandler}
              type="button"
            >
              <img
                alt={i18n('lightboxImageAlt')}
                className="Lightbox__object"
                onContextMenu={(ev: React.MouseEvent<HTMLImageElement>) => {
                  // These are the only image types supported by Electron's NativeImage
                  if (
                    ev &&
                    contentType !== IMAGE_PNG &&
                    !/image\/jpe?g/g.test(contentType)
                  ) {
                    ev.preventDefault();
                  }
                }}
                src={objectURL}
                ref={imageRef}
              />
            </button>
          </div>
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
          className="Lightbox__object Lightbox__object--video"
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

  const hasNext = !isZoomed && selectedIndex < media.length - 1;
  const hasPrevious = !isZoomed && selectedIndex > 0;

  return root
    ? createPortal(
        <div
          className={classNames('Lightbox Lightbox__container', {
            'Lightbox__container--zoom': isZoomed,
          })}
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
          <div className="Lightbox__animated">
            <div
              className="Lightbox__main-container"
              tabIndex={-1}
              ref={focusRef}
            >
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
              <animated.div
                className={classNames('Lightbox__object--container', {
                  'Lightbox__object--container--zoom': isZoomed,
                })}
                ref={animateRef}
                style={{
                  transform: to(
                    [scale, translateX, translateY],
                    (s, x, y) => `translate(${x}px, ${y}px) scale(${s})`
                  ),
                }}
              >
                {content}
              </animated.div>
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
          </div>
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
  message: MediaItemMessageType;
}): JSX.Element {
  const conversation = getConversation(message.conversationId);

  return (
    <div className="Lightbox__header--container">
      <div className="Lightbox__header--avatar">
        <Avatar
          acceptedMessageRequest={conversation.acceptedMessageRequest}
          avatarPath={conversation.avatarPath}
          badge={undefined}
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
