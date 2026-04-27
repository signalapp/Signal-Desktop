// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { ConversationType } from '../../state/ducks/conversations.preload.ts';
import type { LocalizerType } from '../../types/Util.std.ts';
import { I18n } from '../I18n.dom.tsx';

import { SystemMessage } from './SystemMessage.dom.tsx';
import { MessageTimestamp } from './MessageTimestamp.dom.tsx';
import { UserText } from '../UserText.dom.tsx';

export type PropsData = {
  sender: ConversationType;
  timestamp: number;
};

export type PropsHousekeeping = {
  i18n: LocalizerType;
};

export type Props = PropsData & PropsHousekeeping;

export function ChangeNumberNotification(props: Props): React.JSX.Element {
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
