// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useRef, useState, useEffect } from 'react';
import classNames from 'classnames';
import { Blurhash } from 'react-blurhash';

import type { LocalizerType, ThemeType } from '../../types/Util';
import { Spinner } from '../Spinner';

import type { AttachmentType } from '../../types/Attachment';
import {
  hasNotResolved,
  getImageDimensions,
  defaultBlurHash,
} from '../../types/Attachment';
import * as log from '../../logging/log';

const MAX_GIF_REPEAT = 4;
const MAX_GIF_TIME = 8;

export type Props = {
  readonly attachment: AttachmentType;
  readonly size?: number;
  readonly tabIndex: number;

  readonly i18n: LocalizerType;
  readonly theme?: ThemeType;

  readonly reducedMotion?: boolean;

  onError(): void;
  showVisualAttachment(): void;
  kickOffAttachmentDownload(): void;
};

type MediaEvent = React.SyntheticEvent<HTMLVideoElement, Event>;

export const GIF: React.FC<Props> = props => {
  const {
    attachment,
    size,
    tabIndex,

    i18n,
    theme,

    reducedMotion = Boolean(
      window.Accessibility && window.Accessibility.reducedMotionSetting
    ),

    onError,
    showVisualAttachment,
    kickOffAttachmentDownload,
  } = props;

  const tapToPlay = reducedMotion;

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
          (error && error.stack) || error
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
      kickOffAttachmentDownload();
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

    kickOffAttachmentDownload();
  };

  const isPending = Boolean(attachment.pending);
  const isNotResolved = hasNotResolved(attachment) && !isPending;

  let fileSize: JSX.Element | undefined;
  if (isNotResolved && attachment.fileSize) {
    fileSize = (
      <div className="module-image--gif__filesize">
        {attachment.fileSize} · GIF
      </div>
    );
  }

  let gif: JSX.Element | undefined;
  if (isNotResolved || isPending) {
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

  let overlay: JSX.Element | undefined;
  if ((tapToPlay && !isPlaying) || isNotResolved) {
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
        onClick={onOverlayClick}
        onKeyDown={onOverlayKeyDown}
        tabIndex={tabIndex}
      >
        <span />
      </button>
    );
  }

  let spinner: JSX.Element | undefined;
  if (isPending) {
    spinner = (
      <div className="module-image__download-pending--spinner-container">
        <div
          className="module-image__download-pending--spinner"
          title={i18n('loading')}
        >
          <Spinner moduleClassName="module-image-spinner" svgSize="small" />
        </div>
      </div>
    );
  }

  return (
    <div className="module-image module-image--gif">
      {gif}
      {overlay}
      {spinner}
      {fileSize}
    </div>
  );
};
