// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';

import { Tooltip } from './Tooltip';
import { LocalizerType } from '../types/Util';

type PropsType = {
  className?: string;
  i18n: LocalizerType;
};

export const InContactsIcon = (props: PropsType): JSX.Element => {
  const { className, i18n } = props;

  /* eslint-disable jsx-a11y/no-noninteractive-tabindex */
  return (
    <span className="module-in-contacts-icon__tooltip">
      <Tooltip content={i18n('contactInAddressBook')}>
        <span
          aria-label={i18n('contactInAddressBook')}
          className={classNames('module-in-contacts-icon__icon', className)}
          role="img"
          tabIndex={0}
        />
      </Tooltip>
    </span>
  );
  /* eslint-enable jsx-a11y/no-noninteractive-tabindex */
};
