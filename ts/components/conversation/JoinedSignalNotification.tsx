// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../../types/Util';
import { I18n } from '../I18n';

import { SystemMessage } from './SystemMessage';
import { MessageTimestamp } from './MessageTimestamp';

export type PropsData = {
  timestamp: number;
};

export type PropsHousekeeping = {
  i18n: LocalizerType;
};

export type Props = PropsData & PropsHousekeeping;

export function JoinedSignalNotification(props: Props): JSX.Element {
  const { i18n, timestamp } = props;

  return (
    <SystemMessage
      contents={
        <>
          <I18n id="icu:JoinedSignal--notification" i18n={i18n} />
          &nbsp;·&nbsp;
          <MessageTimestamp i18n={i18n} timestamp={timestamp} />
        </>
      }
      icon="info"
    />
  );
}
