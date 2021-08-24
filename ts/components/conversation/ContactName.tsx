// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';

import { Emojify } from './Emojify';
import { ContactNameColorType } from '../../types/Colors';
import { LocalizerType } from '../../types/Util';
import { getClassNamesFor } from '../../util/getClassNamesFor';

export type PropsType = {
  contactNameColor?: ContactNameColorType;
  firstName?: string;
  i18n: LocalizerType;
  module?: string;
  name?: string;
  phoneNumber?: string;
  preferFirstName?: boolean;
  profileName?: string;
  title: string;
};

export const ContactName = ({
  contactNameColor,
  firstName,
  module,
  preferFirstName,
  title,
}: PropsType): JSX.Element => {
  const getClassName = getClassNamesFor('module-contact-name', module);

  let text: string;
  if (preferFirstName) {
    text = firstName || title || '';
  } else {
    text = title || '';
  }

  return (
    <span
      className={classNames(
        getClassName(''),
        contactNameColor ? getClassName(`--${contactNameColor}`) : null
      )}
      dir="auto"
    >
      <Emojify text={text} />
    </span>
  );
};
