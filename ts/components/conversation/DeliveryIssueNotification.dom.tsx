// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactElement } from 'react';
import type { ConversationType } from '../../state/ducks/conversations.preload.ts';
import type { LocalizerType } from '../../types/Util.std.ts';
import { I18n } from '../I18n.dom.tsx';
import { DeliveryIssueDialog } from './DeliveryIssueDialog.dom.tsx';
import { UserText } from '../UserText.dom.tsx';
import { AxoChatEvent } from '../../axo/chat/AxoChatEvent.dom.tsx';

export type PropsDataType = {
  sender?: ConversationType;
  inGroup: boolean;
};

type PropsHousekeepingType = {
  i18n: LocalizerType;
};

export type PropsType = PropsDataType & PropsHousekeepingType;

export function DeliveryIssueNotification(
  props: PropsType
): ReactElement | null {
  const { i18n, inGroup, sender } = props;

  if (sender == null) {
    return null;
  }

  return (
    <AxoChatEvent.Root variant="secondary">
      <AxoChatEvent.Body symbol="info-circle">
        <I18n
          id="icu:DeliveryIssue--notification"
          components={{
            sender: <UserText text={sender.firstName || sender.title} />,
          }}
          i18n={i18n}
        />
      </AxoChatEvent.Body>
      <DeliveryIssueDialog i18n={i18n} inGroup={inGroup} sender={sender}>
        <AxoChatEvent.Action>
          {i18n('icu:DeliveryIssue--learnMore')}
        </AxoChatEvent.Action>
      </DeliveryIssueDialog>
    </AxoChatEvent.Root>
  );
}
