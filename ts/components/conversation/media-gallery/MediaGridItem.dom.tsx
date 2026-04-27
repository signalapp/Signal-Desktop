// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, type ReactNode } from 'react';
import type { ReadonlyDeep } from 'type-fest';

import { formatFileSize } from '../../../util/formatFileSize.std.ts';
import { formatDuration } from '../../../util/formatDuration.std.ts';
import { missingCaseError } from '../../../util/missingCaseError.std.ts';
import type { LocalizerType, ThemeType } from '../../../types/Util.std.ts';
import type { MediaItemType } from '../../../types/MediaItem.std.ts';
import type { AttachmentForUIType } from '../../../types/Attachment.std.ts';
import {
  getAlt,
  getUrl,
  defaultBlurHash,
  isGIF,
  isVideoAttachment,
} from '../../../util/Attachment.std.ts';
import { ImageOrBlurhash } from '../../ImageOrBlurhash.dom.tsx';
import { SpinnerV2 } from '../../SpinnerV2.dom.tsx';
import { tw } from '../../../axo/tw.dom.tsx';
import { AxoSymbol } from '../../../axo/AxoSymbol.dom.tsx';
import {
  useAttachmentStatus,
  type AttachmentStatusType,
} from '../../../hooks/useAttachmentStatus.std.ts';

export type Props = Readonly<{
  mediaItem: ReadonlyDeep<MediaItemType>;
  showSize: boolean;
  onClick?: (attachmentState: AttachmentStatusType['state']) => void;
  i18n: LocalizerType;
  theme?: ThemeType;
  renderContextMenu: (
    mediaItem: ReadonlyDeep<MediaItemType>,
    children: ReactNode
  ) => React.JSX.Element;
}>;

export function MediaGridItem(props: Props): React.JSX.Element {
  const {
    mediaItem: { attachment },
    showSize,
    i18n,
    theme,
    onClick,
    renderContextMenu,
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

  return renderContextMenu(
    props.mediaItem,
    <button
      type="button"
      className={tw(
        'relative',
        'shrink grow',
        'aspect-square',
        'overflow-hidden rounded-md',
        'flex items-center justify-center'
      )}
      onClick={handleClick}
      aria-label={label}
    >
      {imageOrBlurHash}

      <MetadataOverlay
        i18n={i18n}
        status={status}
        attachment={attachment}
        showSize={showSize}
      />
      <SpinnerOverlay status={status} />
    </button>
  );
}

type SpinnerOverlayProps = Readonly<{
  status: AttachmentStatusType;
}>;

function SpinnerOverlay(
  props: SpinnerOverlayProps
): React.JSX.Element | undefined {
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
  showSize: boolean;
}>;

function MetadataOverlay(
  props: MetadataOverlayProps
): React.JSX.Element | undefined {
  const { i18n, status, attachment, showSize } = props;

  if (
    status.state === 'ReadyToShow' &&
    !isGIF([attachment]) &&
    !isVideoAttachment(attachment) &&
    !showSize
  ) {
    return undefined;
  }

  let text: string;
  if (!showSize && isGIF([attachment]) && status.state === 'ReadyToShow') {
    text = i18n('icu:message--getNotificationText--gif');
  } else if (
    !showSize &&
    isVideoAttachment(attachment) &&
    attachment.duration != null
  ) {
    text = formatDuration(attachment.duration);
  } else {
    text = formatFileSize(attachment.size);
  }

  return (
    <div
      className={tw(
        'absolute inset-e-0 bottom-0 h-11.5 w-full',
        // This is an overlay gradient to ensure that the text has contrast
        // against the image/blurhash.
        // oxlint-disable-next-line better-tailwindcss/no-restricted-classes
        'bg-linear-to-b from-transparent to-[rgba(0,0,0,0.6)]'
      )}
    >
      <span
        className={tw(
          'absolute inset-e-2 bottom-1.5',
          'type-caption text-[12px] text-label-primary-on-color'
        )}
      >
        {text}
      </span>
    </div>
  );
}
