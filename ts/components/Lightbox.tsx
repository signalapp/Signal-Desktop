// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { createPortal } from 'react-dom';
import { noop } from 'lodash';
import { useSpring, animated, to } from '@react-spring/web';

import type { ReadonlyDeep } from 'type-fest';
import type {
  ConversationType,
  SaveAttachmentActionCreatorType,
} from '../state/ducks/conversations';
import type { LocalizerType } from '../types/Util';
import type { MediaItemType } from '../types/MediaItem';
import * as GoogleChrome from '../util/GoogleChrome';
import * as log from '../logging/log';
import * as Errors from '../types/errors';
import { Avatar, AvatarSize } from './Avatar';
import { IMAGE_PNG, isImage, isVideo } from '../types/MIME';
import { formatDateTimeForAttachment } from '../util/timestamp';
import { formatDuration } from '../util/formatDuration';
import { isGIF, isIncremental } from '../types/Attachment';
import { useRestoreFocus } from '../hooks/useRestoreFocus';
import { usePrevious } from '../hooks/usePrevious';
import { arrow } from '../util/keyboard';
import { drop } from '../util/drop';
import { isCmdOrCtrl } from '../hooks/useKeyboardShortcuts';
import type { ForwardMessagesPayload } from '../state/ducks/globalModals';
import { ForwardMessagesModalType } from './ForwardMessagesModal';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { formatFileSize } from '../util/formatFileSize';
import { SECOND } from '../util/durations';
import { Toast } from './Toast';

export type PropsType = {
  children?: ReactNode;
  closeLightbox: () => unknown;
  getConversation?: (id: string) => ConversationType;
  i18n: LocalizerType;
  isViewOnce?: boolean;
  media: ReadonlyArray<ReadonlyDeep<MediaItemType>>;
  playbackDisabled: boolean;
  saveAttachment: SaveAttachmentActionCreatorType;
  selectedIndex: number;
  toggleForwardMessagesModal: (payload: ForwardMessagesPayload) => unknown;
  onMediaPlaybackStart: () => void;
  onNextAttachment: () => void;
  onPrevAttachment: () => void;
  onSelectAttachment: (index: number) => void;
  hasPrevMessage?: boolean;
  hasNextMessage?: boolean;
};

const ZOOM_SCALE = 3;

const TWO_SECONDS = 2.5 * SECOND;

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

const THUMBNAIL_SPRING_CONFIG = {
  mass: 1,
  tension: 986,
  friction: 64,
  velocity: 0,
};

const THUMBNAIL_WIDTH = 44;
const THUMBNAIL_PADDING = 8;
const THUMBNAIL_FULL_WIDTH = THUMBNAIL_WIDTH + THUMBNAIL_PADDING;

export function Lightbox({
  children,
  closeLightbox,
  getConversation,
  media,
  i18n,
  isViewOnce = false,
  saveAttachment,
  selectedIndex,
  toggleForwardMessagesModal,
  playbackDisabled,
  onMediaPlaybackStart,
  onNextAttachment,
  onPrevAttachment,
  onSelectAttachment,
  hasNextMessage,
  hasPrevMessage,
}: PropsType): JSX.Element | null {
  const hasThumbnails = media.length > 1;
  const messageId = media.at(0)?.message.id;
  const prevMessageId = usePrevious(messageId, messageId);
  const needsAnimation = messageId !== prevMessageId;
  const [root, setRoot] = React.useState<HTMLElement | undefined>();

  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(
    null
  );
  const [shouldShowDownloadToast, setShouldShowDownloadToast] = useState(false);
  const downloadToastTimeout = useRef<NodeJS.Timeout | number | undefined>();

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

  const currentItem = media[selectedIndex];
  const {
    attachment,
    contentType,
    loop = false,
    objectURL,
    incrementalObjectUrl,
  } = currentItem || {};

  const isAttachmentGIF = isGIF(attachment ? [attachment] : undefined);
  const isDownloading =
    attachment &&
    isIncremental(attachment) &&
    attachment.pending &&
    !attachment.path;

  const onMouseLeaveVideo = useCallback(() => {
    if (downloadToastTimeout.current) {
      clearTimeout(downloadToastTimeout.current);
      downloadToastTimeout.current = undefined;
    }
    if (!isDownloading) {
      return;
    }

    setShouldShowDownloadToast(false);
  }, [isDownloading, setShouldShowDownloadToast]);
  const onUserInteractionOnVideo = useCallback(
    (event: React.MouseEvent<HTMLVideoElement, MouseEvent>) => {
      if (downloadToastTimeout.current) {
        clearTimeout(downloadToastTimeout.current);
        downloadToastTimeout.current = undefined;
      }
      if (!isDownloading) {
        return;
      }
      const elementRect = event.currentTarget.getBoundingClientRect();
      const bottomThreshold = elementRect.bottom - 75;

      setShouldShowDownloadToast(true);

      if (event.clientY >= bottomThreshold) {
        return;
      }
      downloadToastTimeout.current = setTimeout(onMouseLeaveVideo, TWO_SECONDS);
    },
    [isDownloading, onMouseLeaveVideo, setShouldShowDownloadToast]
  );

  const onPrevious = useCallback(
    (
      event: KeyboardEvent | React.MouseEvent<HTMLButtonElement, MouseEvent>
    ) => {
      event.preventDefault();
      event.stopPropagation();

      if (isZoomed) {
        return;
      }

      onPrevAttachment();
    },
    [isZoomed, onPrevAttachment]
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

      onNextAttachment();
    },
    [isZoomed, onNextAttachment]
  );

  const onTimeUpdate = useCallback(() => {
    if (!videoElement) {
      return;
    }
    setVideoTime(videoElement.currentTime);
  }, [setVideoTime, videoElement]);

  const handleSave = useCallback(
    (
      event: KeyboardEvent | React.MouseEvent<HTMLButtonElement, MouseEvent>
    ) => {
      if (isViewOnce) {
        return;
      }

      event.stopPropagation();
      event.preventDefault();

      const mediaItem = media[selectedIndex];
      const { attachment: attachmentToSave, message, index } = mediaItem;

      saveAttachment(attachmentToSave, message.sentAt, index + 1);
    },
    [isViewOnce, media, saveAttachment, selectedIndex]
  );

  const handleForward = (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    if (isViewOnce) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    closeLightbox();
    const mediaItem = media[selectedIndex];
    toggleForwardMessagesModal({
      type: ForwardMessagesModalType.Forward,
      messageIds: [mediaItem.message.id],
    });
  };

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Escape': {
          closeLightbox();

          event.preventDefault();
          event.stopPropagation();

          break;
        }

        case arrow('start'):
          onPrevious(event);
          break;

        case arrow('end'):
          onNext(event);
          break;

        case 's':
          if (isCmdOrCtrl(event)) {
            handleSave(event);
          }
          break;

        default:
      }
    },
    [closeLightbox, onNext, onPrevious, handleSave]
  );

  const onClose = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    event.preventDefault();

    closeLightbox();
  };

  const playVideo = useCallback(() => {
    if (!videoElement) {
      return;
    }

    if (videoElement.paused) {
      onMediaPlaybackStart();
      void videoElement.play().catch(error => {
        log.error('Lightbox: Failed to play video', Errors.toLogFormat(error));
      });
    } else {
      videoElement.pause();
    }
  }, [videoElement, onMediaPlaybackStart]);

  useEffect(() => {
    if (!videoElement || videoElement.paused) {
      return;
    }

    if (playbackDisabled) {
      videoElement.pause();
    }
  }, [playbackDisabled, videoElement]);

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

  const thumbnailsMarginInlineStart =
    0 - (selectedIndex * THUMBNAIL_FULL_WIDTH + THUMBNAIL_WIDTH / 2);

  const reducedMotion = useReducedMotion();

  // eslint-disable-next-line react-hooks/exhaustive-deps -- FIXME
  const [thumbnailsStyle, thumbnailsAnimation] = useSpring(
    {
      immediate: reducedMotion,
      config: THUMBNAIL_SPRING_CONFIG,
      to: {
        marginInlineStart: thumbnailsMarginInlineStart,
        opacity: hasThumbnails ? 1 : 0,
      },
    },
    [selectedIndex, hasThumbnails]
  );

  useEffect(() => {
    if (!needsAnimation) {
      return;
    }

    thumbnailsAnimation.stop();
    thumbnailsAnimation.set({
      marginInlineStart:
        thumbnailsMarginInlineStart +
        (selectedIndex === 0 ? 1 : -1) * THUMBNAIL_FULL_WIDTH,
      opacity: 0,
    });
    drop(
      Promise.all(
        thumbnailsAnimation.start({
          marginInlineStart: thumbnailsMarginInlineStart,
          opacity: 1,
        })
      )
    );
  }, [
    needsAnimation,
    selectedIndex,
    thumbnailsMarginInlineStart,
    thumbnailsAnimation,
  ]);

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

      drop(
        Promise.all(
          springApi.start({
            scale: ZOOM_SCALE,
            translateX: shouldTranslateX ? x : undefined,
            translateY: shouldTranslateY ? y : undefined,
          })
        )
      );
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

      drop(
        Promise.all(
          springApi.start({
            scale: ZOOM_SCALE,
            translateX: x,
            translateY: y,
          })
        )
      );
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

        drop(
          Promise.all(
            springApi.start({
              scale: ZOOM_SCALE,
              translateX: shouldTranslateX ? x : undefined,
              translateY: shouldTranslateY ? y : undefined,
            })
          )
        );

        setIsZoomed(true);
      } else {
        drop(Promise.all(springApi.start(INITIAL_IMAGE_TRANSFORM)));
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
                alt={i18n('icu:lightboxImageAlt')}
                className="Lightbox__object"
                data-testid={attachment.fileName}
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
            aria-label={i18n('icu:lightboxImageAlt')}
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
          key={objectURL || incrementalObjectUrl}
          loop={shouldLoop}
          ref={setVideoElement}
          onMouseMove={onUserInteractionOnVideo}
          onMouseLeave={onMouseLeaveVideo}
        >
          <source src={objectURL || incrementalObjectUrl} />
        </video>
      );
    } else if (isUnsupportedImageType || isUnsupportedVideoType) {
      content = (
        <button
          aria-label={i18n('icu:unsupportedAttachment')}
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
          aria-label={i18n('icu:unsupportedAttachment')}
          className="Lightbox__object Lightbox__unsupported Lightbox__unsupported--file"
          onClick={onClose}
          type="button"
        />
      );
    }
  }

  const hasNext =
    !isZoomed && (selectedIndex < media.length - 1 || hasNextMessage);
  const hasPrevious = !isZoomed && (selectedIndex > 0 || hasPrevMessage);

  return root
    ? createPortal(
        <div
          className={classNames('Lightbox Lightbox__container', {
            'Lightbox__container--zoom': isZoomed,
          })}
          onClick={(event: React.MouseEvent<HTMLDivElement>) => {
            event.stopPropagation();
            event.preventDefault();

            closeLightbox();
          }}
          onKeyUp={(event: React.KeyboardEvent<HTMLDivElement>) => {
            if (
              (containerRef && event.target !== containerRef.current) ||
              event.keyCode !== 27
            ) {
              return;
            }

            closeLightbox();
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
                    item={currentItem}
                  />
                ) : (
                  <div />
                )}
                <div className="Lightbox__controls">
                  {!isViewOnce ? (
                    <button
                      aria-label={i18n('icu:forwardMessage')}
                      className="Lightbox__button Lightbox__button--forward"
                      onClick={handleForward}
                      type="button"
                    />
                  ) : null}
                  {!isViewOnce ? (
                    <button
                      aria-label={i18n('icu:save')}
                      className="Lightbox__button Lightbox__button--save"
                      onClick={handleSave}
                      type="button"
                    />
                  ) : null}
                  <button
                    aria-label={i18n('icu:close')}
                    className="Lightbox__button Lightbox__button--close"
                    onClick={closeLightbox}
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
                {isDownloading ? (
                  <div
                    className={classNames(
                      'Lightbox__toast-container',
                      shouldShowDownloadToast
                        ? 'Lightbox__toast-container--visible'
                        : null
                    )}
                  >
                    <Toast onClose={noop}>
                      {attachment.totalDownloaded && attachment.size
                        ? i18n('icu:lightBoxDownloading', {
                            downloaded: formatFileSize(
                              attachment.totalDownloaded
                            ),
                            total: formatFileSize(attachment.size),
                          })
                        : undefined}
                    </Toast>
                  </div>
                ) : null}
                {content}

                {hasPrevious && (
                  <div className="Lightbox__nav-prev">
                    <button
                      aria-label={i18n('icu:previous')}
                      className="Lightbox__button Lightbox__button--previous"
                      onClick={onPrevious}
                      type="button"
                    />
                  </div>
                )}
                {hasNext && (
                  <div className="Lightbox__nav-next">
                    <button
                      aria-label={i18n('icu:next')}
                      className="Lightbox__button Lightbox__button--next"
                      onClick={onNext}
                      type="button"
                    />
                  </div>
                )}
              </animated.div>
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
              <div className="Lightbox__thumbnails--container">
                <animated.div
                  className="Lightbox__thumbnails"
                  style={thumbnailsStyle}
                >
                  {hasThumbnails
                    ? media.map((item, index) => (
                        <button
                          className={classNames({
                            Lightbox__thumbnail: true,
                            'Lightbox__thumbnail--selected':
                              index === selectedIndex,
                          })}
                          key={item.thumbnailObjectUrl}
                          type="button"
                          onClick={(
                            event: React.MouseEvent<
                              HTMLButtonElement,
                              MouseEvent
                            >
                          ) => {
                            event.stopPropagation();
                            event.preventDefault();

                            onSelectAttachment(index);
                          }}
                        >
                          {item.thumbnailObjectUrl ? (
                            <img
                              alt={i18n('icu:lightboxImageAlt')}
                              src={item.thumbnailObjectUrl}
                            />
                          ) : (
                            <div className="Lightbox__thumbnail--unavailable" />
                          )}
                        </button>
                      ))
                    : undefined}
                </animated.div>
              </div>
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
  item,
}: {
  getConversation: (id: string) => ConversationType;
  i18n: LocalizerType;
  item: ReadonlyDeep<MediaItemType>;
}): JSX.Element {
  const { message } = item;
  const conversation = getConversation(message.conversationId);

  const now = Date.now();

  return (
    <div className="Lightbox__header--container">
      <div className="Lightbox__header--avatar">
        <Avatar
          acceptedMessageRequest={conversation.acceptedMessageRequest}
          avatarUrl={conversation.avatarUrl}
          badge={undefined}
          color={conversation.color}
          conversationType={conversation.type}
          i18n={i18n}
          isMe={conversation.isMe}
          phoneNumber={conversation.e164}
          profileName={conversation.profileName}
          sharedGroupNames={conversation.sharedGroupNames}
          size={AvatarSize.THIRTY_TWO}
          title={conversation.title}
          unblurredAvatarUrl={conversation.unblurredAvatarUrl}
        />
      </div>
      <div className="Lightbox__header--content">
        <div className="Lightbox__header--name">{conversation.title}</div>
        <div className="Lightbox__header--timestamp">
          {formatDateTimeForAttachment(i18n, message.sentAt ?? now)}
        </div>
      </div>
    </div>
  );
}
