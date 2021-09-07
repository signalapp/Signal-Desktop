// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { ConversationType } from '../../state/ducks/conversations';
import { LocalizerType } from '../../types/Util';
import { Intl } from '../Intl';

import { SystemMessage } from './SystemMessage';
import { Timestamp } from './Timestamp';
import { Emojify } from './Emojify';

export type PropsData = {
  sender: ConversationType;
  timestamp: number;
};

export type PropsHousekeeping = {
  i18n: LocalizerType;
};

export type Props = PropsData & PropsHousekeeping;

export const ChangeNumberNotification: React.FC<Props> = props => {
  const { i18n, sender, timestamp } = props;

  return (
    <SystemMessage
      contents={
        <>
          <Intl
            id="ChangeNumber--notification"
            components={{
              sender: <Emojify text={sender.firstName || sender.title} />,
            }}
            i18n={i18n}
          />
          &nbsp;·&nbsp;
          <Timestamp i18n={i18n} timestamp={timestamp} />
        </>
      }
      icon="phone"
    />
  );
};
