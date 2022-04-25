// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect } from 'react';
import classNames from 'classnames';
import { Blurhash } from 'react-blurhash';

import type { AttachmentType } from '../types/Attachment';
import type { LocalizerType } from '../types/Util';
import { Spinner } from './Spinner';
import { TextAttachment } from './TextAttachment';
import { ThemeType } from '../types/Util';
import {
  defaultBlurHash,
  hasNotResolved,
  isDownloaded,
  isDownloading,
  isGIF,
} from '../types/Attachment';
import { getClassNamesFor } from '../util/getClassNamesFor';
import { isVideoTypeSupported } from '../util/GoogleChrome';

export type PropsType = {
  readonly attachment?: AttachmentType;
  readonly i18n: LocalizerType;
  readonly isThumbnail?: boolean;
  readonly label: string;
  readonly moduleClassName?: string;
  readonly queueStoryDownload: (storyId: string) => unknown;
  readonly storyId: string;
};

export const StoryImage = ({
  attachment,
  i18n,
  isThumbnail,
  label,
  moduleClassName,
  queueStoryDownload,
  storyId,
}: PropsType): JSX.Element | null => {
  const shouldDownloadAttachment =
    !isDownloaded(attachment) &&
    !isDownloading(attachment) &&
    !hasNotResolved(attachment);

  useEffect(() => {
    if (shouldDownloadAttachment) {
      queueStoryDownload(storyId);
    }
  }, [queueStoryDownload, shouldDownloadAttachment, storyId]);

  if (!attachment) {
    return null;
  }

  const isPending = Boolean(attachment.pending) && !attachment.textAttachment;
  const isNotReadyToShow = hasNotResolved(attachment) || isPending;
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
        autoPlay
        className={getClassName('__image')}
        controls={false}
        loop={shouldLoop}
      >
        <source src={attachment.url} />
      </video>
    );
  } else {
    storyElement = (
      <img
        alt={label}
        className={getClassName('__image')}
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
        <div className="StoryImage__spinner-bubble" title={i18n('loading')}>
          <Spinner moduleClassName="StoryImage__spinner" svgSize="small" />
        </div>
      </div>
    );
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
    </div>
  );
};
