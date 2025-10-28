// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { ConversationType } from '../../state/ducks/conversations.preload.js';
import type { LocalizerType } from '../../types/Util.std.js';
import { I18n } from '../I18n.dom.js';

import { SystemMessage } from './SystemMessage.dom.js';
import { MessageTimestamp } from './MessageTimestamp.dom.js';
import { UserText } from '../UserText.dom.js';

export type PropsData = {
  sender: ConversationType;
  timestamp: number;
};

export type PropsHousekeeping = {
  i18n: LocalizerType;
};

export type Props = PropsData & PropsHousekeeping;

export function ChangeNumberNotification(props: Props): JSX.Element {
  const { i18n, sender, timestamp } = props;

  return (
    <SystemMessage
      contents={
        <>
          <I18n
            id="icu:ChangeNumber--notification"
            components={{
              sender: (
                <UserText text={sender.title || sender.firstName || ''} />
              ),
            }}
            i18n={i18n}
          />
          &nbsp;·&nbsp;
          <MessageTimestamp i18n={i18n} timestamp={timestamp} />
        </>
      }
      icon="phone"
    />
  );
}
