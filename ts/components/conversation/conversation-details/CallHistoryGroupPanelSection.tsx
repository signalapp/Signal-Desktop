// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react';
import classNames from 'classnames';
import type { CallStatus } from '../../../types/CallDisposition';
import {
  CallDirection,
  CallType,
  DirectCallStatus,
  GroupCallStatus,
  type CallHistoryGroup,
} from '../../../types/CallDisposition';
import type { LocalizerType } from '../../../types/I18N';
import { formatDate, formatTime } from '../../../util/timestamp';
import { PanelSection } from './PanelSection';
import { getDirectCallNotificationText } from '../../../util/callingNotification';

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
    <PanelSection title={formatDate(i18n, callHistoryGroup.timestamp)}>
      <ol className="ConversationDetails__CallHistoryGroup__List">
        {callHistoryGroup.children.map(child => {
          return (
            <li
              key={child.callId}
              className="ConversationDetails__CallHistoryGroup__Item"
            >
              <span
                className={classNames(
                  'ConversationDetails__CallHistoryGroup__ItemIcon',
                  {
                    'ConversationDetails__CallHistoryGroup__ItemIcon--Audio':
                      callHistoryGroup.type === CallType.Audio,
                    'ConversationDetails__CallHistoryGroup__ItemIcon--Video':
                      callHistoryGroup.type === CallType.Video ||
                      callHistoryGroup.type === CallType.Group,
                    'ConversationDetails__CallHistoryGroup__ItemIcon--Adhoc':
                      callHistoryGroup.type === CallType.Adhoc,
                  }
                )}
              />
              <span className="ConversationDetails__CallHistoryGroup__ItemLabel">
                {describeCallHistory(
                  i18n,
                  callHistoryGroup.type,
                  callHistoryGroup.direction,
                  callHistoryGroup.status
                )}
              </span>
              <span className="ConversationDetails__CallHistoryGroup__ItemTimestamp">
                {formatTime(i18n, child.timestamp, Date.now(), false)}
              </span>
            </li>
          );
        })}
      </ol>
    </PanelSection>
  );
}
