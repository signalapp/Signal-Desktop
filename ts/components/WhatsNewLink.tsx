// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { Intl } from './Intl';

import type { LocalizerType } from '../types/Util';

export type PropsType = {
  i18n: LocalizerType;
  showWhatsNewModal: () => unknown;
};

export const WhatsNewLink = (props: PropsType): JSX.Element => {
  const { i18n, showWhatsNewModal } = props;

  return (
    <Intl
      i18n={i18n}
      id="whatsNew"
      components={[
        <button className="WhatsNew" type="button" onClick={showWhatsNewModal}>
          {i18n('viewReleaseNotes')}
        </button>,
      ]}
    />
  );
};
