// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { JSX } from 'react';

import {
  CallDirection,
  CallType,
  DirectCallStatus,
  GroupCallStatus,
} from '../../../types/CallDisposition.std.ts';
import type {
  CallStatus,
  CallHistoryGroup,
} from '../../../types/CallDisposition.std.ts';
import type { LocalizerType } from '../../../types/I18N.std.ts';
import { formatDate, formatTime } from '../../../util/formatTimestamp.dom.ts';
import { getDirectCallNotificationText } from '../../../util/callingNotification.std.ts';
import { AxoList } from '../../../axo/items/AxoList.dom.tsx';
import { AxoItem } from '../../../axo/items/AxoItem.dom.tsx';
import { AxoTextItem } from '../../../axo/items/AxoTextItem.dom.tsx';
import type { AxoSymbol } from '../../../axo/AxoSymbol.dom.tsx';

function describeCallHistory(
  i18n: LocalizerType,
  type: CallType,
  direction: CallDirection,
  status: CallStatus
): string {
  if (type === CallType.Adhoc) {
    return i18n('icu:CallHistory__Description--Adhoc');
  }

  if (
    (type === CallType.Audio || type === CallType.Video) &&
    (status === DirectCallStatus.Accepted ||
      status === DirectCallStatus.Declined ||
      status === DirectCallStatus.Deleted ||
      status === DirectCallStatus.Missed ||
      status === DirectCallStatus.Pending)
  ) {
    return getDirectCallNotificationText(direction, type, status, i18n);
  }

  if (status === GroupCallStatus.Missed) {
    if (direction === CallDirection.Incoming) {
      return i18n('icu:CallHistory__DescriptionVideoCall--Missed');
    }
    return i18n('icu:CallHistory__DescriptionVideoCall--Unanswered');
  }
  if (status === GroupCallStatus.Declined) {
    return i18n('icu:CallHistory__DescriptionVideoCall--Declined');
  }
  return i18n('icu:CallHistory__DescriptionVideoCall--Default', { direction });
}

export type CallHistoryPanelSectionProps = Readonly<{
  callHistoryGroup: CallHistoryGroup;
  i18n: LocalizerType;
}>;

export function CallHistoryGroupPanelSection({
  callHistoryGroup,
  i18n,
}: CallHistoryPanelSectionProps): JSX.Element {
  return (
    <AxoList.Root>
      <AxoList.Header>
        <AxoList.Label>
          {formatDate(i18n, callHistoryGroup.timestamp)}
        </AxoList.Label>
      </AxoList.Header>
      <AxoList.Body>
        <AxoItem.Group>
          {callHistoryGroup.children.map(child => {
            let symbol: AxoSymbol.Name | null = null;

            if (callHistoryGroup.type === CallType.Audio) {
              symbol = 'phone';
            } else if (
              callHistoryGroup.type === CallType.Video ||
              callHistoryGroup.type === CallType.Group
            ) {
              symbol = 'videocamera';
            } else if (callHistoryGroup.type === CallType.Adhoc) {
              symbol = 'link';
            }

            return (
              <AxoTextItem.Root
                key={child.callId}
                symbol={symbol}
                label={describeCallHistory(
                  i18n,
                  callHistoryGroup.type,
                  callHistoryGroup.direction,
                  callHistoryGroup.status
                )}
                // oxlint-disable-next-line react/purity
                value={formatTime(i18n, child.timestamp, Date.now(), false)}
              />
            );
          })}
        </AxoItem.Group>
      </AxoList.Body>
    </AxoList.Root>
  );
}
