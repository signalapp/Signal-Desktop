// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { Fragment } from 'react';

import type { ItemClickEvent } from './types/ItemClickEvent.std.js';
import type { LocalizerType, ThemeType } from '../../../types/Util.std.js';
import type {
  GenericMediaItemType,
  MediaItemType,
  LinkPreviewMediaItemType,
} from '../../../types/MediaItem.std.js';
import { MediaGridItem } from './MediaGridItem.dom.js';
import { DocumentListItem } from './DocumentListItem.dom.js';
import type { DataProps as LinkPreviewItemPropsType } from './LinkPreviewItem.dom.js';
import type { AttachmentStatusType } from '../../../hooks/useAttachmentStatus.std.js';
import { missingCaseError } from '../../../util/missingCaseError.std.js';
import { strictAssert } from '../../../util/assert.std.js';
import { tw } from '../../../axo/tw.dom.js';

export type Props = {
  header?: string;
  i18n: LocalizerType;
  onItemClick: (event: ItemClickEvent) => unknown;
  theme?: ThemeType;
  mediaItems: ReadonlyArray<GenericMediaItemType>;

  renderLinkPreviewItem: (props: LinkPreviewItemPropsType) => JSX.Element;
};

function getMediaItemKey(mediaItem: GenericMediaItemType): string {
  const { message } = mediaItem;
  if (mediaItem.type === 'media' || mediaItem.type === 'document') {
    return `attachment-${message.id}-${mediaItem.index}`;
  }
  return `attachment-${message.id}-preview`;
}

type VerifiedMediaItems =
  | {
      type: 'media' | 'document';
      entries: ReadonlyArray<MediaItemType>;
    }
  | {
      type: 'link';
      entries: ReadonlyArray<LinkPreviewMediaItemType>;
    };

function verifyMediaItems(
  mediaItems: ReadonlyArray<GenericMediaItemType>
): VerifiedMediaItems {
  const first = mediaItems.at(0);
  strictAssert(first != null, 'AttachmentSection cannot be empty');

  const { type } = first;

  const result = {
    type,
    entries: mediaItems.filter(item => item.type === type),
  };

  strictAssert(
    result.entries.length === mediaItems.length,
    'Some AttachmentSection items have conflicting types'
  );

  return result as VerifiedMediaItems;
}

export function AttachmentSection({
  i18n,
  header,
  mediaItems,
  onItemClick,
  theme,

  renderLinkPreviewItem,
}: Props): JSX.Element {
  const verified = verifyMediaItems(mediaItems);
  switch (verified.type) {
    case 'media':
      return (
        <section className={tw('ps-5')}>
          <h2 className={tw('ps-1 pt-4 pb-2 font-semibold')}>{header}</h2>
          <div className={tw('flex flex-row flex-wrap gap-1 pb-1')}>
            {verified.entries.map(mediaItem => {
              const onClick = (state: AttachmentStatusType['state']) => {
                onItemClick({ mediaItem, state });
              };

              return (
                <MediaGridItem
                  key={getMediaItemKey(mediaItem)}
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
    case 'document':
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
            {verified.entries.map(mediaItem => {
              const onClick = (state: AttachmentStatusType['state']) => {
                onItemClick({ mediaItem, state });
              };

              return (
                <DocumentListItem
                  i18n={i18n}
                  key={getMediaItemKey(mediaItem)}
                  mediaItem={mediaItem}
                  onClick={onClick}
                />
              );
            })}
          </div>
        </section>
      );
    case 'link':
      return (
        <section
          className={tw('px-6', 'mb-3 divide-y border-b-border-primary pb-3')}
        >
          <h2 className={tw('pt-1.5 pb-2 font-semibold')}>{header}</h2>
          <div>
            {verified.entries.map(mediaItem => {
              const onClick = (state: AttachmentStatusType['state']) => {
                onItemClick({ mediaItem, state });
              };

              return (
                <Fragment key={getMediaItemKey(mediaItem)}>
                  {renderLinkPreviewItem({
                    mediaItem,
                    onClick,
                  })}
                </Fragment>
              );
            })}
          </div>
        </section>
      );
    default:
      throw missingCaseError(verified);
  }
}
