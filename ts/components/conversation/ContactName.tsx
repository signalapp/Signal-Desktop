// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { LocalizerType } from '../../types/Util';
import { Emojify } from './Emojify';

export interface PropsType {
  i18n: LocalizerType;
  title: string;
  module?: string;
  name?: string;
  phoneNumber?: string;
  profileName?: string;
}

export const ContactName = ({ module, title }: PropsType): JSX.Element => {
  const prefix = module || 'module-contact-name';

  return (
    <span className={prefix} dir="auto">
      <Emojify text={title || ''} />
    </span>
  );
};
