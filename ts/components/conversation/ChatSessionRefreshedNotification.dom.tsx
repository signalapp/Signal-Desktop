// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import type { LocalizerType } from '../../types/Util.std.ts';
import { ChatSessionRefreshedDialog } from './ChatSessionRefreshedDialog.dom.tsx';
import { AxoChatEvent } from '../../axo/chat/AxoChatEvent.dom.tsx';

type PropsHousekeepingType = {
  i18n: LocalizerType;
};

export type PropsType = PropsHousekeepingType;

export function ChatSessionRefreshedNotification(
  props: PropsType
): ReactElement {
  const { i18n } = props;
  return (
    <AxoChatEvent.Root variant="secondary">
      <AxoChatEvent.Body symbol="arrow-clockwise">
        {i18n('icu:ChatRefresh--notification')}
      </AxoChatEvent.Body>
      <ChatSessionRefreshedDialog i18n={i18n}>
        <AxoChatEvent.Action>
          {i18n('icu:ChatRefresh--learnMore')}
        </AxoChatEvent.Action>
      </ChatSessionRefreshedDialog>
    </AxoChatEvent.Root>
  );
}
