// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { ReadonlyDeep } from 'type-fest';
import { formatFileSize } from '../../../util/formatFileSize';
import type { LocalizerType, ThemeType } from '../../../types/Util';
import type { MediaItemType } from '../../../types/MediaItem';
import type { AttachmentForUIType } from '../../../types/Attachment';
import {
  getAlt,
  getUrl,
  defaultBlurHash,
  isGIF,
} from '../../../types/Attachment';
import { ImageOrBlurhash } from '../../ImageOrBlurhash';
import { SpinnerV2 } from '../../SpinnerV2';
import { tw } from '../../../axo/tw';
import { AxoSymbol } from '../../../axo/AxoSymbol';

export type Props = Readonly<{
  mediaItem: ReadonlyDeep<MediaItemType>;
  onClick?: (ev: React.MouseEvent) => void;
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
  if (attachment.url || attachment.incrementalUrl) {
    label = i18n('icu:imageOpenAlt');
  } else if (attachment.pending) {
    label = i18n('icu:cancelDownload');
  } else {
    label = i18n('icu:startDownload');
  }

  return (
    <button
      type="button"
      className={tw(
        'relative size-30 overflow-hidden rounded-md',
        'flex items-center justify-center'
      )}
      onClick={onClick}
      aria-label={label}
    >
      {imageOrBlurHash}

      <MetadataOverlay i18n={i18n} attachment={attachment} />
      <SpinnerOverlay attachment={attachment} />
    </button>
  );
}

type SpinnerOverlayProps = Readonly<{
  attachment: AttachmentForUIType;
}>;

function SpinnerOverlay(props: SpinnerOverlayProps): JSX.Element | undefined {
  const { attachment } = props;

  if (attachment.url != null || attachment.incrementalUrl != null) {
    return undefined;
  }

  const spinnerValue =
    (!attachment.incrementalUrl &&
      attachment.size &&
      attachment.totalDownloaded) ||
    undefined;

  return (
    <div
      className={tw(
        'absolute size-12.5 rounded-full bg-fill-on-media',
        'flex items-center justify-center'
      )}
    >
      {attachment.pending && (
        <SpinnerV2
          variant="no-background"
          size={44}
          strokeWidth={2}
          marginRatio={1}
          min={0}
          max={attachment.size}
          value={spinnerValue}
        />
      )}
      <div className={tw('absolute text-label-primary-on-color')}>
        <AxoSymbol.Icon
          symbol={attachment.pending ? 'x' : 'arrow-down'}
          size={24}
          label={null}
        />
      </div>
    </div>
  );
}

type MetadataOverlayProps = Readonly<{
  i18n: LocalizerType;
  attachment: AttachmentForUIType;
}>;

function MetadataOverlay(props: MetadataOverlayProps): JSX.Element | undefined {
  const { i18n, attachment } = props;

  const canBeShown =
    attachment.url != null || attachment.incrementalUrl != null;
  if (canBeShown && !isGIF([attachment])) {
    return undefined;
  }

  let text: string;
  if (isGIF([attachment]) && canBeShown) {
    text = i18n('icu:message--getNotificationText--gif');
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
