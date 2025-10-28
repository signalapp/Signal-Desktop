// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback } from 'react';

import type { ReadonlyDeep } from 'type-fest';
import { formatFileSize } from '../../../util/formatFileSize.std.js';
import { formatDuration } from '../../../util/formatDuration.std.js';
import { missingCaseError } from '../../../util/missingCaseError.std.js';
import type { LocalizerType, ThemeType } from '../../../types/Util.std.js';
import type { MediaItemType } from '../../../types/MediaItem.std.js';
import type { AttachmentForUIType } from '../../../types/Attachment.std.js';
import {
  getAlt,
  getUrl,
  defaultBlurHash,
  isGIF,
  isVideoAttachment,
} from '../../../util/Attachment.std.js';
import { ImageOrBlurhash } from '../../ImageOrBlurhash.dom.js';
import { SpinnerV2 } from '../../SpinnerV2.dom.js';
import { tw } from '../../../axo/tw.dom.js';
import { AxoSymbol } from '../../../axo/AxoSymbol.dom.js';
import {
  useAttachmentStatus,
  type AttachmentStatusType,
} from '../../../hooks/useAttachmentStatus.std.js';

export type Props = Readonly<{
  mediaItem: ReadonlyDeep<MediaItemType>;
  onClick?: (attachmentState: AttachmentStatusType['state']) => void;
  i18n: LocalizerType;
  theme?: ThemeType;
}>;

export function MediaGridItem(props: Props): JSX.Element {
  const {
    mediaItem: { attachment },
    i18n,
    theme,
    onClick,
  } = props;

  const resolvedBlurHash = attachment.blurHash || defaultBlurHash(theme);
  const url = getUrl(attachment);
  const status = useAttachmentStatus(attachment);

  const { width, height } = attachment;

  const imageOrBlurHash = (
    <ImageOrBlurhash
      className={tw('object-cover')}
      src={url}
      intrinsicWidth={width}
      intrinsicHeight={height}
      alt={getAlt(attachment, i18n)}
      blurHash={resolvedBlurHash}
    />
  );

  let label: string;
  if (status.state === 'ReadyToShow') {
    label = i18n('icu:imageOpenAlt');
  } else if (status.state === 'Downloading') {
    label = i18n('icu:cancelDownload');
  } else if (status.state === 'NeedsDownload') {
    label = i18n('icu:startDownload');
  } else {
    throw missingCaseError(status);
  }

  const handleClick = useCallback(
    (ev: React.MouseEvent) => {
      ev.preventDefault();

      onClick?.(status.state);
    },
    [onClick, status.state]
  );

  return (
    <button
      type="button"
      className={tw(
        'relative size-30 overflow-hidden rounded-md',
        'flex items-center justify-center'
      )}
      onClick={handleClick}
      aria-label={label}
    >
      {imageOrBlurHash}

      <MetadataOverlay i18n={i18n} status={status} attachment={attachment} />
      <SpinnerOverlay status={status} />
    </button>
  );
}

type SpinnerOverlayProps = Readonly<{
  status: AttachmentStatusType;
}>;

function SpinnerOverlay(props: SpinnerOverlayProps): JSX.Element | undefined {
  const { status } = props;

  if (status.state === 'ReadyToShow') {
    return undefined;
  }

  return (
    <div
      className={tw(
        'absolute size-12.5 rounded-full bg-fill-on-media',
        'flex items-center justify-center'
      )}
    >
      {status.state === 'Downloading' && (
        <SpinnerV2
          variant="no-background"
          size={44}
          strokeWidth={2}
          marginRatio={1}
          min={0}
          max={status.size}
          value={status.totalDownloaded}
        />
      )}
      <div className={tw('absolute text-label-primary-on-color')}>
        <AxoSymbol.Icon
          symbol={status.state === 'Downloading' ? 'x' : 'arrow-down'}
          size={24}
          label={null}
        />
      </div>
    </div>
  );
}

type MetadataOverlayProps = Readonly<{
  i18n: LocalizerType;
  status: AttachmentStatusType;
  attachment: AttachmentForUIType;
}>;

function MetadataOverlay(props: MetadataOverlayProps): JSX.Element | undefined {
  const { i18n, status, attachment } = props;

  if (
    status.state === 'ReadyToShow' &&
    !isGIF([attachment]) &&
    !isVideoAttachment(attachment)
  ) {
    return undefined;
  }

  let text: string;
  if (isGIF([attachment]) && status.state === 'ReadyToShow') {
    text = i18n('icu:message--getNotificationText--gif');
  } else if (isVideoAttachment(attachment) && attachment.duration != null) {
    text = formatDuration(attachment.duration);
  } else {
    text = formatFileSize(attachment.size);
  }

  return (
    <div
      className={tw(
        'absolute end-0 bottom-0 h-11.5 w-full',
        // This is an overlay gradient to ensure that the text has contrast
        // against the image/blurhash.
        // eslint-disable-next-line better-tailwindcss/no-restricted-classes
        'bg-linear-to-b from-transparent to-[rgba(0,0,0,0.6)]'
      )}
    >
      <span
        className={tw(
          'absolute end-2 bottom-1.5',
          'type-caption text-[12px] text-label-primary-on-color'
        )}
      >
        {text}
      </span>
    </div>
  );
}
