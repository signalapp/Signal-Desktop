// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import { Blurhash } from 'react-blurhash';

import type { AttachmentType } from '../types/Attachment';
import type { LocalizerType } from '../types/Util';
import { Spinner } from './Spinner';
import { ThemeType } from '../types/Util';
import {
  defaultBlurHash,
  isDownloaded,
  hasNotResolved,
  isDownloading,
} from '../types/Attachment';
import { getClassNamesFor } from '../util/getClassNamesFor';

export type PropsType = {
  readonly attachment?: AttachmentType;
  i18n: LocalizerType;
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
  const [attachmentBroken, setAttachmentBroken] = useState<boolean>(false);

  const shouldDownloadAttachment =
    !isDownloaded(attachment) && !isDownloading(attachment);

  useEffect(() => {
    if (shouldDownloadAttachment) {
      queueStoryDownload(storyId);
    }
  }, [queueStoryDownload, shouldDownloadAttachment, storyId]);

  if (!attachment) {
    return null;
  }

  const isPending = Boolean(attachment.pending);
  const isNotReadyToShow = hasNotResolved(attachment) || isPending;

  const getClassName = getClassNamesFor('StoryImage', moduleClassName);

  let storyElement: JSX.Element;
  if (isNotReadyToShow) {
    storyElement = (
      <Blurhash
        hash={attachment.blurHash || defaultBlurHash(ThemeType.dark)}
        height={attachment.height}
        width={attachment.width}
      />
    );
  } else if (attachmentBroken) {
    storyElement = (
      <div
        aria-label={i18n('StoryImage__error')}
        className="StoryImage__error"
      />
    );
  } else {
    storyElement = (
      <img
        alt={label}
        className={getClassName('__image')}
        onError={() => setAttachmentBroken(true)}
        src={
          isThumbnail && attachment.thumbnail
            ? attachment.thumbnail.url
            : attachment.url
        }
      />
    );
  }

  let spinner: JSX.Element | undefined;
  if (isPending) {
    spinner = (
      <div className="StoryImage__spinner-container">
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
      {spinner}
    </div>
  );
};
