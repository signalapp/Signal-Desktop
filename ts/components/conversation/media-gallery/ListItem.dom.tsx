// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback } from 'react';

import moment from 'moment';
import { missingCaseError } from '../../../util/missingCaseError.std.js';
import type { GenericMediaItemType } from '../../../types/MediaItem.std.js';
import type { AttachmentForUIType } from '../../../types/Attachment.std.js';
import type { LocalizerType } from '../../../types/Util.std.js';
import { SpinnerV2 } from '../../SpinnerV2.dom.js';
import { tw } from '../../../axo/tw.dom.js';
import { AriaClickable } from '../../../axo/AriaClickable.dom.js';
import { AxoSymbol } from '../../../axo/AxoSymbol.dom.js';
import { UserText } from '../../UserText.dom.js';
import {
  useAttachmentStatus,
  type AttachmentStatusType,
} from '../../../hooks/useAttachmentStatus.std.js';

export type Props = {
  i18n: LocalizerType;
  mediaItem: GenericMediaItemType;
  thumbnail: React.ReactNode;
  title: string;
  subtitle: React.ReactNode;
  readyLabel: string;
  onClick: (status: AttachmentStatusType['state']) => void;
  onShowMessage: () => void;
};

export function ListItem({
  i18n,
  mediaItem,
  thumbnail,
  title,
  subtitle,
  readyLabel,
  onClick,
  onShowMessage,
}: Props): JSX.Element {
  const { message } = mediaItem;
  let attachment: AttachmentForUIType | undefined;

  if (mediaItem.type === 'link') {
    attachment = mediaItem.preview.image;
  } else {
    ({ attachment } = mediaItem);
  }

  const timestamp = message.receivedAtMs || message.receivedAt;

  let label: string;

  const status = useAttachmentStatus(attachment);

  const handleClick = useCallback(
    (ev: React.MouseEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      onClick(status?.state || 'ReadyToShow');
    },
    [onClick, status?.state]
  );

  const handleDateClick = useCallback(
    (ev: React.MouseEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      onShowMessage();
    },
    [onShowMessage]
  );

  if (status == null || status.state === 'ReadyToShow') {
    label = readyLabel;
  } else if (status.state === 'NeedsDownload') {
    label = i18n('icu:downloadAttachment');
  } else if (status.state === 'Downloading') {
    label = i18n('icu:cancelDownload');
  } else {
    throw missingCaseError(status);
  }

  let button: JSX.Element | undefined;
  if (
    status != null &&
    status.state !== 'ReadyToShow' &&
    mediaItem.type !== 'link'
  ) {
    button = (
      <div
        className={tw(
          'relative -ms-1 size-7 shrink-0 rounded-full bg-fill-secondary',
          'flex items-center justify-center'
        )}
      >
        {status.state === 'Downloading' && (
          <SpinnerV2
            variant="no-background-incoming"
            size={28}
            strokeWidth={1}
            marginRatio={1}
            min={0}
            max={status.size}
            value={status.totalDownloaded}
          />
        )}
        <div
          className={tw(
            'absolute flex items-center justify-center text-label-primary'
          )}
        >
          <AxoSymbol.Icon
            symbol={status.state === 'Downloading' ? 'x' : 'arrow-down'}
            size={16}
            label={null}
          />
        </div>
      </div>
    );
  }

  return (
    <AriaClickable.Root
      className={tw(
        'mx-2.5 flex flex-row gap-3 rounded-lg px-3.5 py-2',
        'data-hovered:bg-fill-secondary',
        'data-focused:bg-fill-secondary',
        'data-pressed:bg-fill-secondary-pressed',
        mediaItem.type === 'link' ? undefined : 'items-center'
      )}
    >
      <div className={tw('shrink-0')}>{thumbnail}</div>
      <div className={tw('grow overflow-hidden text-start')}>
        <h3 className={tw('truncate')}>
          <UserText text={title} />
        </h3>
        <div className={tw('type-body-small leading-4 text-label-secondary')}>
          {subtitle}
        </div>
      </div>
      <AriaClickable.HiddenTrigger aria-label={label} onClick={handleClick} />
      <AriaClickable.SubWidget>
        <button
          type="button"
          className={tw(
            'shrink-0 self-stretch',
            mediaItem.type === 'link' ? undefined : 'flex items-center',
            'type-body-small text-label-secondary'
          )}
          aria-label={i18n('icu:ListItem__show-message')}
          onClick={handleDateClick}
        >
          {moment(timestamp).format('MMM D')}
        </button>
      </AriaClickable.SubWidget>
      {button}
    </AriaClickable.Root>
  );
}
