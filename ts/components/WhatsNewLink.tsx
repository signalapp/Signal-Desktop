// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { I18n } from './I18n';

import type { LocalizerType } from '../types/Util';

export type PropsType = {
  i18n: LocalizerType;
  showWhatsNewModal: () => unknown;
};

export function WhatsNewLink(props: PropsType): JSX.Element {
  const { i18n, showWhatsNewModal } = props;

  return (
    <I18n
      i18n={i18n}
      id="icu:whatsNew"
      components={{
        whatsNew: (
          <button
            className="WhatsNew"
            type="button"
            onClick={showWhatsNewModal}
          >
            {i18n('icu:viewReleaseNotes')}
          </button>
        ),
      }}
    />
  );
}
