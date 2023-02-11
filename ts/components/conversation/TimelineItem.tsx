// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactChild, RefObject } from 'react';
import React from 'react';

import type { LocalizerType, ThemeType } from '../../types/Util';

import type { InteractionModeType } from '../../state/ducks/conversations';
import { TimelineDateHeader } from './TimelineDateHeader';
import type {
  Props as AllMessageProps,
  PropsData as TimelineMessageProps,
  PropsActions as MessageActionsType,
} from './TimelineMessage';
import type { PropsActionsType as CallingNotificationActionsType } from './CallingNotification';
import { CallingNotification } from './CallingNotification';
import { ChatSessionRefreshedNotification } from './ChatSessionRefreshedNotification';
import type { PropsDataType as DeliveryIssueProps } from './DeliveryIssueNotification';
import { DeliveryIssueNotification } from './DeliveryIssueNotification';
import type { PropsData as ChangeNumberNotificationProps } from './ChangeNumberNotification';
import { ChangeNumberNotification } from './ChangeNumberNotification';
import type { CallingNotificationType } from '../../util/callingNotification';
import { InlineNotificationWrapper } from './InlineNotificationWrapper';
import type { PropsData as UnsupportedMessageProps } from './UnsupportedMessage';
import { UnsupportedMessage } from './UnsupportedMessage';
import type { PropsData as TimerNotificationProps } from './TimerNotification';
import { TimerNotification } from './TimerNotification';
import type {
  PropsActions as SafetyNumberActionsType,
  PropsData as SafetyNumberNotificationProps,
} from './SafetyNumberNotification';
import { SafetyNumberNotification } from './SafetyNumberNotification';
import type { PropsData as VerificationNotificationProps } from './VerificationNotification';
import { VerificationNotification } from './VerificationNotification';
import type { PropsData as GroupNotificationProps } from './GroupNotification';
import { GroupNotification } from './GroupNotification';
import type {
  PropsDataType as GroupV2ChangeProps,
  PropsActionsType as GroupV2ChangeActionsType,
} from './GroupV2Change';
import { GroupV2Change } from './GroupV2Change';
import type { PropsDataType as GroupV1MigrationProps } from './GroupV1Migration';
import { GroupV1Migration } from './GroupV1Migration';
import type { SmartContactRendererType } from '../../groupChange';
import { ResetSessionNotification } from './ResetSessionNotification';
import type { PropsType as ProfileChangeNotificationPropsType } from './ProfileChangeNotification';
import { ProfileChangeNotification } from './ProfileChangeNotification';
import type { PropsType as PaymentEventNotificationPropsType } from './PaymentEventNotification';
import { PaymentEventNotification } from './PaymentEventNotification';
import type { PropsDataType as ConversationMergeNotificationPropsType } from './ConversationMergeNotification';
import { ConversationMergeNotification } from './ConversationMergeNotification';
import type { FullJSXType } from '../Intl';
import { TimelineMessage } from './TimelineMessage';

type CallHistoryType = {
  type: 'callHistory';
  data: CallingNotificationType;
};
type ChatSessionRefreshedType = {
  type: 'chatSessionRefreshed';
  data: null;
};
type DeliveryIssueType = {
  type: 'deliveryIssue';
  data: DeliveryIssueProps;
};
type MessageType = {
  type: 'message';
  data: TimelineMessageProps;
};
type UnsupportedMessageType = {
  type: 'unsupportedMessage';
  data: UnsupportedMessageProps;
};
type TimerNotificationType = {
  type: 'timerNotification';
  data: TimerNotificationProps;
};
type UniversalTimerNotificationType = {
  type: 'universalTimerNotification';
  data: null;
};
type ChangeNumberNotificationType = {
  type: 'changeNumberNotification';
  data: ChangeNumberNotificationProps;
};
type SafetyNumberNotificationType = {
  type: 'safetyNumberNotification';
  data: SafetyNumberNotificationProps;
};
type VerificationNotificationType = {
  type: 'verificationNotification';
  data: VerificationNotificationProps;
};
type GroupNotificationType = {
  type: 'groupNotification';
  data: GroupNotificationProps;
};
type GroupV2ChangeType = {
  type: 'groupV2Change';
  data: GroupV2ChangeProps;
};
type GroupV1MigrationType = {
  type: 'groupV1Migration';
  data: GroupV1MigrationProps;
};
type ResetSessionNotificationType = {
  type: 'resetSessionNotification';
  data: null;
};
type ProfileChangeNotificationType = {
  type: 'profileChange';
  data: ProfileChangeNotificationPropsType;
};
type ConversationMergeNotificationType = {
  type: 'conversationMerge';
  data: ConversationMergeNotificationPropsType;
};
type PaymentEventType = {
  type: 'paymentEvent';
  data: Omit<PaymentEventNotificationPropsType, 'i18n'>;
};

export type TimelineItemType = (
  | CallHistoryType
  | ChangeNumberNotificationType
  | ChatSessionRefreshedType
  | ConversationMergeNotificationType
  | DeliveryIssueType
  | GroupNotificationType
  | GroupV1MigrationType
  | GroupV2ChangeType
  | MessageType
  | ProfileChangeNotificationType
  | ResetSessionNotificationType
  | SafetyNumberNotificationType
  | TimerNotificationType
  | UniversalTimerNotificationType
  | UnsupportedMessageType
  | VerificationNotificationType
  | PaymentEventType
) & { timestamp: number };

type PropsLocalType = {
  containerElementRef: RefObject<HTMLElement>;
  conversationId: string;
  item?: TimelineItemType;
  id: string;
  isNextItemCallingNotification: boolean;
  isSelected: boolean;
  selectMessage: (messageId: string, conversationId: string) => unknown;
  shouldRenderDateHeader: boolean;
  renderContact: SmartContactRendererType<FullJSXType>;
  renderUniversalTimerNotification: () => JSX.Element;
  i18n: LocalizerType;
  interactionMode: InteractionModeType;
  theme: ThemeType;
};

type PropsActionsType = MessageActionsType &
  CallingNotificationActionsType &
  GroupV2ChangeActionsType &
  SafetyNumberActionsType;

export type PropsType = PropsLocalType &
  PropsActionsType &
  Pick<
    AllMessageProps,
    | 'containerWidthBreakpoint'
    | 'getPreferredBadge'
    | 'renderEmojiPicker'
    | 'renderAudioAttachment'
    | 'renderReactionPicker'
    | 'shouldCollapseAbove'
    | 'shouldCollapseBelow'
    | 'shouldHideMetadata'
  >;

export class TimelineItem extends React.PureComponent<PropsType> {
  public override render(): JSX.Element | null {
    const {
      containerElementRef,
      conversationId,
      getPreferredBadge,
      i18n,
      id,
      isNextItemCallingNotification,
      isSelected,
      item,
      renderUniversalTimerNotification,
      returnToActiveCall,
      selectMessage,
      shouldCollapseAbove,
      shouldCollapseBelow,
      shouldHideMetadata,
      shouldRenderDateHeader,
      startCallingLobby,
      theme,
      ...reducedProps
    } = this.props;

    if (!item) {
      // This can happen under normal conditions.
      //
      // `<Timeline>` and `<TimelineItem>` are connected to Redux separately. If a
      //   timeline item is removed from Redux, `<TimelineItem>` might re-render before
      //   `<Timeline>` does, which means we'll try to render nothing. This should resolve
      //   itself quickly, as soon as `<Timeline>` re-renders.
      return null;
    }

    let itemContents: ReactChild;
    if (item.type === 'message') {
      itemContents = (
        <TimelineMessage
          {...reducedProps}
          {...item.data}
          isSelected={isSelected}
          selectMessage={selectMessage}
          shouldCollapseAbove={shouldCollapseAbove}
          shouldCollapseBelow={shouldCollapseBelow}
          shouldHideMetadata={shouldHideMetadata}
          containerElementRef={containerElementRef}
          getPreferredBadge={getPreferredBadge}
          i18n={i18n}
          theme={theme}
        />
      );
    } else {
      let notification;

      if (item.type === 'unsupportedMessage') {
        notification = (
          <UnsupportedMessage {...reducedProps} {...item.data} i18n={i18n} />
        );
      } else if (item.type === 'callHistory') {
        notification = (
          <CallingNotification
            conversationId={conversationId}
            i18n={i18n}
            isNextItemCallingNotification={isNextItemCallingNotification}
            returnToActiveCall={returnToActiveCall}
            startCallingLobby={startCallingLobby}
            {...item.data}
          />
        );
      } else if (item.type === 'chatSessionRefreshed') {
        notification = (
          <ChatSessionRefreshedNotification {...reducedProps} i18n={i18n} />
        );
      } else if (item.type === 'deliveryIssue') {
        notification = (
          <DeliveryIssueNotification
            {...item.data}
            {...reducedProps}
            i18n={i18n}
          />
        );
      } else if (item.type === 'timerNotification') {
        notification = (
          <TimerNotification {...reducedProps} {...item.data} i18n={i18n} />
        );
      } else if (item.type === 'universalTimerNotification') {
        notification = renderUniversalTimerNotification();
      } else if (item.type === 'changeNumberNotification') {
        notification = (
          <ChangeNumberNotification
            {...reducedProps}
            {...item.data}
            i18n={i18n}
          />
        );
      } else if (item.type === 'safetyNumberNotification') {
        notification = (
          <SafetyNumberNotification
            {...reducedProps}
            {...item.data}
            i18n={i18n}
          />
        );
      } else if (item.type === 'verificationNotification') {
        notification = (
          <VerificationNotification
            {...reducedProps}
            {...item.data}
            i18n={i18n}
          />
        );
      } else if (item.type === 'groupNotification') {
        notification = (
          <GroupNotification {...reducedProps} {...item.data} i18n={i18n} />
        );
      } else if (item.type === 'groupV2Change') {
        notification = (
          <GroupV2Change {...reducedProps} {...item.data} i18n={i18n} />
        );
      } else if (item.type === 'groupV1Migration') {
        notification = (
          <GroupV1Migration
            {...reducedProps}
            {...item.data}
            i18n={i18n}
            getPreferredBadge={getPreferredBadge}
            theme={theme}
          />
        );
      } else if (item.type === 'conversationMerge') {
        notification = (
          <ConversationMergeNotification
            {...reducedProps}
            {...item.data}
            i18n={i18n}
          />
        );
      } else if (item.type === 'resetSessionNotification') {
        notification = (
          <ResetSessionNotification {...reducedProps} i18n={i18n} />
        );
      } else if (item.type === 'profileChange') {
        notification = (
          <ProfileChangeNotification
            {...reducedProps}
            {...item.data}
            i18n={i18n}
          />
        );
      } else if (item.type === 'paymentEvent') {
        notification = (
          <PaymentEventNotification
            {...reducedProps}
            {...item.data}
            i18n={i18n}
          />
        );
      } else {
        // Weird, yes, but the idea is to get a compile error when we aren't comprehensive
        //   with our if/else checks above, but also log out the type we don't understand
        //   if we encounter it at runtime.
        const unknownItem: never = item;
        const asItem = unknownItem as TimelineItemType;
        throw new Error(`TimelineItem: Unknown type: ${asItem.type}`);
      }

      itemContents = (
        <InlineNotificationWrapper
          id={id}
          conversationId={conversationId}
          isSelected={isSelected}
          selectMessage={selectMessage}
        >
          {notification}
        </InlineNotificationWrapper>
      );
    }

    if (shouldRenderDateHeader) {
      return (
        <>
          <TimelineDateHeader i18n={i18n} timestamp={item.timestamp} />
          {itemContents}
        </>
      );
    }
    return itemContents;
  }
}
