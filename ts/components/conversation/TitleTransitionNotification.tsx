// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../../types/Util';
import { I18n } from '../I18n';

import { SystemMessage } from './SystemMessage';
import { UserText } from '../UserText';

export type PropsData = {
  oldTitle: string;
};

export type PropsHousekeeping = {
  i18n: LocalizerType;
};

export type Props = PropsData & PropsHousekeeping;

export function TitleTransitionNotification(props: Props): JSX.Element {
  const { i18n, oldTitle } = props;

  return (
    <SystemMessage
      contents={
        <I18n
          id="icu:TitleTransition--notification"
          components={{
            oldTitle: <UserText text={oldTitle} />,
          }}
          i18n={i18n}
        />
      }
      icon="thread"
    />
  );
}
