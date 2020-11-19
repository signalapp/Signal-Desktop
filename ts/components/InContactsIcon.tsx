// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { Tooltip } from './Tooltip';
import { LocalizerType } from '../types/Util';

type PropsType = {
  i18n: LocalizerType;
};

export const InContactsIcon = (props: PropsType): JSX.Element => {
  const { i18n } = props;

  /* eslint-disable jsx-a11y/no-noninteractive-tabindex */
  return (
    <span className="module-in-contacts-icon__tooltip">
      <Tooltip content={i18n('contactInAddressBook')}>
        <span
          tabIndex={0}
          role="img"
          aria-label={i18n('contactInAddressBook')}
          className="module-in-contacts-icon__icon"
        />
      </Tooltip>
    </span>
  );
  /* eslint-enable jsx-a11y/no-noninteractive-tabindex */
};
