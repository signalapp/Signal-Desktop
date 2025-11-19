// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { noop } from 'lodash';

import { tw } from '../../../axo/tw.dom.js';
import { formatFileSize } from '../../../util/formatFileSize.std.js';
import { durationToPlaybackText } from '../../../util/durationToPlaybackText.std.js';
import type { MediaItemType } from '../../../types/MediaItem.std.js';
import type { LocalizerType, ThemeType } from '../../../types/Util.std.js';
import { type AttachmentStatusType } from '../../../hooks/useAttachmentStatus.std.js';
import { useComputePeaks } from '../../../hooks/useComputePeaks.dom.js';
import { ListItem } from './ListItem.dom.js';

const BAR_COUNT = 7;
const MAX_PEAK_HEIGHT = 22;
const MIN_PEAK_HEIGHT = 2;

export type DataProps = Readonly<{
  mediaItem: MediaItemType;
  onClick: (status: AttachmentStatusType['state']) => void;
  onShowMessage: () => void;
}>;

// Provided by smart layer
export type Props = DataProps &
  Readonly<{
    i18n: LocalizerType;
    theme?: ThemeType;
    authorTitle: string;
  }>;

export function AudioListItem({
  i18n,
  mediaItem,
  authorTitle,
  onClick,
  onShowMessage,
}: Props): JSX.Element {
  const { attachment } = mediaItem;

  const { fileName, size: fileSize, url } = attachment;

  const { duration, hasPeaks, peaks } = useComputePeaks({
    audioUrl: url,
    activeDuration: attachment?.duration,
    barCount: BAR_COUNT,
    onCorrupted: noop,
  });

  const subtitle = new Array<string>();

  if (typeof fileSize === 'number') {
    subtitle.push(formatFileSize(fileSize));
  }

  if (attachment.isVoiceMessage) {
    subtitle.push(i18n('icu:AudioListItem__subtitle--voice-message'));
  } else {
    subtitle.push(i18n('icu:AudioListItem__subtitle--audio'));
  }

  subtitle.push(durationToPlaybackText(duration));

  const thumbnail = (
    <div
      className={tw(
        'flex items-center justify-center gap-0.5',
        'bg-elevated-background-tertiary',
        'size-9 rounded-sm'
      )}
    >
      {peaks.map((peak, index) => {
        let height: number;
        if (hasPeaks) {
          height = Math.max(MIN_PEAK_HEIGHT, peak * MAX_PEAK_HEIGHT);
        } else {
          // Intentionally zero when processing or not downloaded
          height = 0;
        }

        return (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            className={tw(
              'rounded bg-label-placeholder p-px',
              'transition-[height] duration-250'
            )}
            style={{ height: `${height}px` }}
          />
        );
      })}
    </div>
  );

  return (
    <ListItem
      i18n={i18n}
      mediaItem={mediaItem}
      thumbnail={thumbnail}
      title={fileName == null ? authorTitle : `${fileName} · ${authorTitle}`}
      subtitle={subtitle.join(' · ')}
      readyLabel={i18n('icu:startDownload')}
      onClick={onClick}
      onShowMessage={onShowMessage}
    />
  );
}
