// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { ItemClickEvent } from './types/ItemClickEvent.std.js';
import type { LocalizerType, ThemeType } from '../../../types/Util.std.js';
import type { MediaItemType } from '../../../types/MediaItem.std.js';
import { DocumentListItem } from './DocumentListItem.dom.js';
import { MediaGridItem } from './MediaGridItem.dom.js';
import type { AttachmentStatusType } from '../../../hooks/useAttachmentStatus.std.js';
import { missingCaseError } from '../../../util/missingCaseError.std.js';
import { tw } from '../../../axo/tw.dom.js';

export type Props = {
  header?: string;
  i18n: LocalizerType;
  mediaItems: ReadonlyArray<MediaItemType>;
  onItemClick: (event: ItemClickEvent) => unknown;
  type: 'media' | 'documents';
  theme?: ThemeType;
};

export function AttachmentSection({
  i18n,
  header,
  type,
  mediaItems,
  onItemClick,
  theme,
}: Props): JSX.Element {
  switch (type) {
    case 'media':
      return (
        <section className={tw('ps-5')}>
          <h2 className={tw('ps-1 pt-4 pb-2 font-semibold')}>{header}</h2>
          <div className={tw('flex flex-row flex-wrap gap-1 pb-1')}>
            {mediaItems.map(mediaItem => {
              const { message, index, attachment } = mediaItem;

              const onClick = (state: AttachmentStatusType['state']) => {
                onItemClick({ type, message, attachment, state });
              };

              return (
                <MediaGridItem
                  key={`${message.id}-${index}`}
                  mediaItem={mediaItem}
                  onClick={onClick}
                  i18n={i18n}
                  theme={theme}
                />
              );
            })}
          </div>
        </section>
      );
    case 'documents':
      return (
        <section
          className={tw(
            'px-6',
            'mb-3 border-b border-b-border-primary pb-3',
            'last:mb-0 last:border-b-0 last:pb-0'
          )}
        >
          <h2 className={tw('pt-1.5 pb-2 font-semibold')}>{header}</h2>
          <div>
            {mediaItems.map(mediaItem => {
              const { message, index, attachment } = mediaItem;

              const onClick = (state: AttachmentStatusType['state']) => {
                onItemClick({ type, message, attachment, state });
              };

              return (
                <DocumentListItem
                  i18n={i18n}
                  key={`${message.id}-${index}`}
                  mediaItem={mediaItem}
                  onClick={onClick}
                />
              );
            })}
          </div>
        </section>
      );
    default:
      throw missingCaseError(type);
  }
}
