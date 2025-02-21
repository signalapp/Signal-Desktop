// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { Blurhash } from 'react-blurhash';

import type { LocalizerType, ThemeType } from '../../types/Util';

import type { AttachmentForUIType } from '../../types/Attachment';
import {
  hasNotResolved,
  getImageDimensions,
  defaultBlurHash,
  isDownloadable,
  isPermanentlyUndownloadable,
} from '../../types/Attachment';
import * as Errors from '../../types/errors';
import * as log from '../../logging/log';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { AttachmentDetailPill } from './AttachmentDetailPill';
import { getSpinner } from './Image';
import { useUndownloadableMediaHandler } from '../../hooks/useUndownloadableMediaHandler';

const MAX_GIF_REPEAT = 4;
const MAX_GIF_TIME = 8;

export type Props = {
  readonly attachment: AttachmentForUIType;
  readonly size?: number;
  readonly tabIndex: number;
  // test-only, to force reduced motion experience
  readonly _forceTapToPlay?: boolean;

  readonly i18n: LocalizerType;
  readonly theme?: ThemeType;

  onError(): void;
  showMediaNoLongerAvailableToast?: () => void;
  showVisualAttachment(): void;
  startDownload(): void;
  cancelDownload(): void;
};

type MediaEvent = React.SyntheticEvent<HTMLVideoElement, Event>;

export function GIF(props: Props): JSX.Element {
  const {
    attachment,
    size,
    tabIndex,
    _forceTapToPlay,

    i18n,
    theme,

    onError,
    showMediaNoLongerAvailableToast,
    showVisualAttachment,
    startDownload,
    cancelDownload,
  } = props;

  const tapToPlay = useReducedMotion() || _forceTapToPlay;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { height, width } = getImageDimensions(attachment, size);

  const [repeatCount, setRepeatCount] = useState(0);
  const [playTime, setPlayTime] = useState(MAX_GIF_TIME);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFocused, setIsFocused] = useState(true);
  const [isPlaying, setIsPlaying] = useState(!tapToPlay);

  useEffect(() => {
    const onFocus = () => setIsFocused(true);
    const onBlur = () => setIsFocused(false);

    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  });

  //
  // Play & Pause video in response to change of `isPlaying` and `repeatCount`.
  //
  useEffect(() => {
    const { current: video } = videoRef;
    if (!video) {
      return;
    }

    if (isPlaying) {
      video.play().catch(error => {
        log.info(
          "Failed to match GIF playback to window's state",
          Errors.toLogFormat(error)
        );
      });
    } else {
      video.pause();
    }
  }, [isPlaying, repeatCount]);

  //
  // Change `isPlaying` in response to focus, play time, and repeat count
  // changes.
  //
  useEffect(() => {
    const { current: video } = videoRef;
    if (!video) {
      return;
    }

    let isTapToPlayPaused = false;
    if (tapToPlay) {
      if (
        playTime + currentTime >= MAX_GIF_TIME ||
        repeatCount >= MAX_GIF_REPEAT
      ) {
        isTapToPlayPaused = true;
      }
    }

    setIsPlaying(isFocused && !isTapToPlayPaused);
  }, [isFocused, playTime, currentTime, repeatCount, tapToPlay]);

  const undownloadableClick = useUndownloadableMediaHandler(
    showMediaNoLongerAvailableToast
  );

  const onTimeUpdate = async (event: MediaEvent): Promise<void> => {
    const { currentTime: reportedTime } = event.currentTarget;
    if (!Number.isNaN(reportedTime)) {
      setCurrentTime(reportedTime);
    }
  };

  const onEnded = async (event: MediaEvent): Promise<void> => {
    const { currentTarget: video } = event;
    const { duration } = video;

    setRepeatCount(repeatCount + 1);
    if (!Number.isNaN(duration)) {
      video.currentTime = 0;

      setCurrentTime(0);
      setPlayTime(playTime + duration);
    }
  };

  const onOverlayClick = (event: React.MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();

    if (!attachment.url) {
      startDownload();
    } else if (tapToPlay) {
      setPlayTime(0);
      setCurrentTime(0);
      setRepeatCount(0);
    }
  };

  const onOverlayKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key !== 'Enter' && event.key !== 'Space') {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (!attachment.url) {
      startDownload();
    } else if (tapToPlay) {
      setPlayTime(0);
      setCurrentTime(0);
      setRepeatCount(0);
    }
  };

  const isPending = Boolean(attachment.pending);
  const isNotResolved = hasNotResolved(attachment) && !isPending;
  const isMediaDownloadable = isDownloadable(attachment);

  let gif: JSX.Element | undefined;
  if (isNotResolved || isPending || !isMediaDownloadable) {
    gif = (
      <Blurhash
        hash={attachment.blurHash || defaultBlurHash(theme)}
        width={width}
        height={height}
        style={{ display: 'block' }}
      />
    );
  } else {
    gif = (
      <video
        ref={videoRef}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
        onError={onError}
        onClick={(event: React.MouseEvent): void => {
          event.preventDefault();
          event.stopPropagation();

          showVisualAttachment();
        }}
        className="module-image--gif__video"
        autoPlay
        playsInline
        muted
        poster={attachment.screenshot && attachment.screenshot.url}
        height={height}
        width={width}
        src={attachment.url}
      />
    );
  }

  const cancelDownloadClick = useCallback(
    (event: React.MouseEvent) => {
      if (cancelDownload) {
        event.preventDefault();
        event.stopPropagation();
        cancelDownload();
      }
    },
    [cancelDownload]
  );
  const cancelDownloadKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (cancelDownload && (event.key === 'Enter' || event.key === 'Space')) {
        event.preventDefault();
        event.stopPropagation();
        cancelDownload();
      }
    },
    [cancelDownload]
  );

  const spinner = getSpinner({
    attachment,
    i18n,
    cancelDownloadClick,
    cancelDownloadKeyDown,
    tabIndex,
  });

  let overlay: JSX.Element | undefined;
  if ((tapToPlay && !isPlaying) || (isNotResolved && isMediaDownloadable)) {
    const className = classNames([
      'module-image__border-overlay',
      'module-image__border-overlay--with-click-handler',
      'module-image--soft-corners',
      isNotResolved
        ? 'module-image--not-downloaded'
        : 'module-image--tap-to-play',
    ]);

    overlay = (
      <button
        type="button"
        className={className}
        aria-label={i18n('icu:GIF--download')}
        onClick={onOverlayClick}
        onKeyDown={onOverlayKeyDown}
        tabIndex={tabIndex}
      >
        <span />
      </button>
    );
  } else if (isPermanentlyUndownloadable(attachment)) {
    overlay = (
      <button
        type="button"
        className="module-image__overlay-circle module-image__overlay-circle--undownloadable"
        aria-label={i18n('icu:mediaNotAvailable')}
        onClick={undownloadableClick}
        tabIndex={tabIndex}
      >
        <div className="module-image__undownloadable-icon" />
      </button>
    );
  }

  const detailPill = isMediaDownloadable ? (
    <AttachmentDetailPill
      attachments={[attachment]}
      cancelDownload={cancelDownload}
      i18n={i18n}
      isGif
      startDownload={startDownload}
    />
  ) : null;

  return (
    <div className="module-image module-image--gif">
      {gif}
      {spinner}
      {overlay}
      {detailPill}
    </div>
  );
}
