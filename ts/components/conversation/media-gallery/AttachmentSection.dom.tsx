// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { Fragment } from 'react';

import type { ItemClickEvent } from './types/ItemClickEvent.std.js';
import type {
  GenericMediaItemType,
  MediaItemType,
  LinkPreviewMediaItemType,
} from '../../../types/MediaItem.std.js';
import { missingCaseError } from '../../../util/missingCaseError.std.js';
import { strictAssert } from '../../../util/assert.std.js';
import { tw } from '../../../axo/tw.dom.js';

export type Props = {
  header?: string;
  onItemClick: (event: ItemClickEvent) => unknown;
  mediaItems: ReadonlyArray<GenericMediaItemType>;

  renderMediaItem: (props: {
    onItemClick: (event: ItemClickEvent) => unknown;
    mediaItem: GenericMediaItemType;
  }) => JSX.Element;
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
      type: 'media' | 'audio' | 'document';
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
  header,
  mediaItems,
  onItemClick,

  renderMediaItem,
}: Props): JSX.Element {
  const verified = verifyMediaItems(mediaItems);
  switch (verified.type) {
    case 'media':
      return (
        <section className={tw('@container px-5')}>
          <h2 className={tw('ps-1 pt-4 pb-2 type-body-medium')}>{header}</h2>
          <div
            className={tw(
              'grid gap-1',
              '@min-[560px]:grid-cols-[repeat(5,_minmax(100px,_120px))]',
              '@min-[455px]:grid-cols-[repeat(4,_minmax(100px,_120px))]',
              'grid-cols-[repeat(3,_minmax(100px,_120px))]',
              'pb-1'
            )}
          >
            {verified.entries.map(mediaItem => {
              return (
                <Fragment key={getMediaItemKey(mediaItem)}>
                  {renderMediaItem({
                    mediaItem,
                    onItemClick,
                  })}
                </Fragment>
              );
            })}
          </div>
        </section>
      );
    case 'document':
    case 'audio':
    case 'link':
      return (
        <section>
          <h2 className={tw('px-6 pt-1.5 pb-2 type-body-medium')}>{header}</h2>
          <div>
            {verified.entries.map(mediaItem => {
              return (
                <Fragment key={getMediaItemKey(mediaItem)}>
                  {renderMediaItem({
                    mediaItem,
                    onItemClick,
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
