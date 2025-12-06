// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../../../types/Util.std.js';
import type { MediaTabType } from '../../../types/MediaItem.std.js';
import { tw } from '../../../axo/tw.dom.js';
import { missingCaseError } from '../../../util/missingCaseError.std.js';

export type Props = {
  i18n: LocalizerType;
  tab: MediaTabType;
};

export function EmptyState({ i18n, tab }: Props): JSX.Element {
  let title: string;
  let description: string;

  switch (tab) {
    case 'media':
      title = i18n('icu:MediaGallery__EmptyState__title--media');
      description = i18n('icu:MediaGallery__EmptyState__description--media');
      break;
    case 'audio':
      title = i18n('icu:MediaGallery__EmptyState__title--audio');
      description = i18n('icu:MediaGallery__EmptyState__description--audio');
      break;
    case 'documents':
      title = i18n('icu:MediaGallery__EmptyState__title--documents');
      description = i18n(
        'icu:MediaGallery__EmptyState__description--documents-2'
      );
      break;
    case 'links':
      title = i18n('icu:MediaGallery__EmptyState__title--links');
      description = i18n('icu:MediaGallery__EmptyState__description--links-2');
      break;
    default:
      throw missingCaseError(tab);
  }

  return (
    <div
      className={tw(
        'absolute inset-0',
        'flex items-center justify-center',
        'pointer-events-none size-full'
      )}
    >
      <div className={tw('text-center')}>
        <h3 className={tw('type-title-small')}>{title}</h3>
        <p className={tw('type-body-medium')}>{description}</p>
      </div>
    </div>
  );
}
