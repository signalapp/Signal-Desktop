// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../../../types/Util.std.js';
import { tw } from '../../../axo/tw.dom.js';
import { missingCaseError } from '../../../util/missingCaseError.std.js';
import { TabViews } from './types/TabViews.std.js';

export type Props = {
  i18n: LocalizerType;
  tab: TabViews;
};

export function EmptyState({ i18n, tab }: Props): JSX.Element {
  let title: string;
  let description: string;

  switch (tab) {
    case TabViews.Media:
      title = i18n('icu:MediaGallery__EmptyState__title--media');
      description = i18n('icu:MediaGallery__EmptyState__description--media');
      break;
    case TabViews.Documents:
      title = i18n('icu:MediaGallery__EmptyState__title--documents');
      description = i18n(
        'icu:MediaGallery__EmptyState__description--documents'
      );
      break;
    case TabViews.Links:
      title = i18n('icu:MediaGallery__EmptyState__title--links');
      description = i18n('icu:MediaGallery__EmptyState__description--links');
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
