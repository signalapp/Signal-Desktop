// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { Blurhash } from 'react-blurhash';

import type { AttachmentType } from '../types/Attachment';
import type { LocalizerType } from '../types/Util';
import { Spinner } from './Spinner';
import { TextAttachment } from './TextAttachment';
import { ThemeType } from '../types/Util';
import {
  defaultBlurHash,
  hasFailed,
  hasNotResolved,
  isDownloaded,
  isDownloading,
  isGIF,
} from '../types/Attachment';
import { getClassNamesFor } from '../util/getClassNamesFor';
import { isVideoTypeSupported } from '../util/GoogleChrome';
import * as log from '../logging/log';
import * as Errors from '../types/errors';

export type PropsType = {
  readonly attachment?: AttachmentType;
  readonly children?: ReactNode;
  readonly firstName: string;
  readonly i18n: LocalizerType;
  readonly isMe?: boolean;
  readonly isMuted?: boolean;
  readonly isPaused?: boolean;
  readonly isThumbnail?: boolean;
  readonly label: string;
  readonly moduleClassName?: string;
  readonly queueStoryDownload: (storyId: string) => unknown;
  readonly storyId: string;
  readonly onMediaPlaybackStart: () => void;
};

export function StoryImage({
  attachment,
  children,
  firstName,
  i18n,
  isMe,
  isMuted,
  isPaused,
  isThumbnail,
  label,
  moduleClassName,
  queueStoryDownload,
  storyId,
  onMediaPlaybackStart,
}: PropsType): JSX.Element | null {
  const shouldDownloadAttachment =
    (!isDownloaded(attachment) && !isDownloading(attachment)) ||
    hasNotResolved(attachment);

  const [hasImgError, setHasImgError] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (shouldDownloadAttachment) {
      queueStoryDownload(storyId);
    }
  }, [queueStoryDownload, shouldDownloadAttachment, storyId]);

  useEffect(() => {
    if (!videoRef.current) {
      return;
    }

    if (isPaused) {
      videoRef.current.pause();
    } else {
      onMediaPlaybackStart();
      void videoRef.current.play().catch(error => {
        log.error(
          'StoryImage: Failed to play video',
          Errors.toLogFormat(error)
        );
      });
    }
  }, [isPaused, onMediaPlaybackStart]);

  useEffect(() => {
    setHasImgError(false);
  }, [attachment?.url, attachment?.thumbnail?.url]);

  if (!attachment) {
    return null;
  }

  const hasError = hasImgError || hasFailed(attachment);
  const isPending =
    Boolean(attachment.pending) && !attachment.textAttachment && !hasError;
  const isNotReadyToShow = hasNotResolved(attachment) || isPending || hasError;
  const isSupportedVideo = isVideoTypeSupported(attachment.contentType);

  const getClassName = getClassNamesFor('StoryImage', moduleClassName);

  let storyElement: JSX.Element;
  if (attachment.textAttachment) {
    storyElement = (
      <TextAttachment
        i18n={i18n}
        isThumbnail={isThumbnail}
        textAttachment={attachment.textAttachment}
      />
    );
  } else if (isNotReadyToShow) {
    storyElement = (
      <Blurhash
        hash={attachment.blurHash || defaultBlurHash(ThemeType.dark)}
        height={attachment.height}
        width={attachment.width}
      />
    );
  } else if (!isThumbnail && isSupportedVideo) {
    const shouldLoop = isGIF(attachment ? [attachment] : undefined);

    storyElement = (
      <video
        autoPlay={!isPaused}
        className={getClassName('__image')}
        controls={false}
        key={attachment.url}
        loop={shouldLoop}
        muted={isMuted}
        ref={videoRef}
      >
        <source src={attachment.url} />
      </video>
    );
  } else {
    storyElement = (
      <img
        alt={label}
        className={getClassName('__image')}
        onError={() => setHasImgError(true)}
        src={
          isThumbnail && attachment.thumbnail
            ? attachment.thumbnail.url
            : attachment.url
        }
      />
    );
  }

  let overlay: JSX.Element | undefined;
  if (isPending) {
    overlay = (
      <div className="StoryImage__overlay-container">
        <div className="StoryImage__spinner-bubble" title={i18n('icu:loading')}>
          <Spinner moduleClassName="StoryImage__spinner" svgSize="small" />
        </div>
      </div>
    );
  } else if (hasError) {
    let content = <div className="StoryImage__error" />;
    if (!isThumbnail) {
      if (isMe) {
        content = <>{i18n('icu:StoryImage__error--you')}</>;
      } else {
        content = (
          <>
            {i18n('icu:StoryImage__error2', {
              name: firstName,
            })}
          </>
        );
      }
    }

    overlay = <div className="StoryImage__overlay-container">{content}</div>;
  }

  return (
    <div
      className={classNames(
        getClassName(''),
        isThumbnail ? getClassName('--thumbnail') : undefined
      )}
    >
      {storyElement}
      {overlay}
      {children}
    </div>
  );
}
