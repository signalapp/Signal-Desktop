// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { LocalizerType } from '../../types/Util';
import { Emojify } from './Emojify';

export type PropsType = {
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
  firstName,
  module,
  preferFirstName,
  title,
}: PropsType): JSX.Element => {
  const prefix = module || 'module-contact-name';

  let text: string;
  if (preferFirstName) {
    text = firstName || title || '';
  } else {
    text = title || '';
  }

  return (
    <span className={prefix} dir="auto">
      <Emojify text={text} />
    </span>
  );
};
