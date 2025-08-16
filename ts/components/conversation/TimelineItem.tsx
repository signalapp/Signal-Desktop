// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactChild, RefObject } from 'react';
import React, { memo } from 'react';

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
import type { PropsData as JoinedSignalNotificationProps } from './JoinedSignalNotification';
import { JoinedSignalNotification } from './JoinedSignalNotification';
import type { PropsData as TitleTransitionNotificationProps } from './TitleTransitionNotification';
import { TitleTransitionNotification } from './TitleTransitionNotification';
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
import type { PropsDataType as PhoneNumberDiscoveryNotificationPropsType } from './PhoneNumberDiscoveryNotification';
import { PhoneNumberDiscoveryNotification } from './PhoneNumberDiscoveryNotification';
import { SystemMessage } from './SystemMessage';
import { TimelineMessage } from './TimelineMessage';
import {
  MessageRequestResponseNotification,
  type MessageRequestResponseNotificationData,
} from './MessageRequestResponseNotification';
import type { MessageRequestState } from './MessageRequestActionsConfirmation';

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
type ContactRemovedNotificationType = {
  type: 'contactRemovedNotification';
  data: null;
};
type ChangeNumberNotificationType = {
  type: 'changeNumberNotification';
  data: ChangeNumberNotificationProps;
};
type JoinedSignalNotificationType = {
  type: 'joinedSignalNotification';
  data: JoinedSignalNotificationProps;
};
type TitleTransitionNotificationType = {
  type: 'titleTransitionNotification';
  data: TitleTransitionNotificationProps;
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
type PhoneNumberDiscoveryNotificationType = {
  type: 'phoneNumberDiscovery';
  data: PhoneNumberDiscoveryNotificationPropsType;
};
type PaymentEventType = {
  type: 'paymentEvent';
  data: Omit<PaymentEventNotificationPropsType, 'i18n'>;
};
type MessageRequestResponseNotificationType = {
  type: 'messageRequestResponse';
  data: MessageRequestResponseNotificationData;
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
  | JoinedSignalNotificationType
  | MessageType
  | PhoneNumberDiscoveryNotificationType
  | ProfileChangeNotificationType
  | ResetSessionNotificationType
  | SafetyNumberNotificationType
  | TimerNotificationType
  | UniversalTimerNotificationType
  | TitleTransitionNotificationType
  | ContactRemovedNotificationType
  | UnsupportedMessageType
  | VerificationNotificationType
  | PaymentEventType
  | MessageRequestResponseNotificationType
) & { timestamp: number };

type PropsLocalType = {
  containerElementRef: RefObject<HTMLElement>;
  conversationId: string;
  item?: TimelineItemType;
  id: string;
  isBlocked: boolean;
  isGroup: boolean;
  isNextItemCallingNotification: boolean;
  isTargeted: boolean;
  targetMessage: (messageId: string, conversationId: string) => unknown;
  shouldRenderDateHeader: boolean;
  onOpenEditNicknameAndNoteModal: (contactId: string) => void;
  onOpenMessageRequestActionsConfirmation(state: MessageRequestState): void;
  platform: string;
  renderContact: SmartContactRendererType<JSX.Element>;
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

export const TimelineItem = memo(function TimelineItem({
  containerElementRef,
  conversationId,
  getPreferredBadge,
  i18n,
  id,
  isBlocked,
  isGroup,
  isNextItemCallingNotification,
  isTargeted,
  item,
  onOpenEditNicknameAndNoteModal,
  onOpenMessageRequestActionsConfirmation,
  onOutgoingAudioCallInConversation,
  onOutgoingVideoCallInConversation,
  platform,
  renderUniversalTimerNotification,
  returnToActiveCall,
  targetMessage,
  setMessageToEdit,
  shouldCollapseAbove,
  shouldCollapseBelow,
  shouldHideMetadata,
  shouldRenderDateHeader,
  theme,
  ...reducedProps
}: PropsType): JSX.Element | null {
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
        isTargeted={isTargeted}
        targetMessage={targetMessage}
        setMessageToEdit={setMessageToEdit}
        shouldCollapseAbove={shouldCollapseAbove}
        shouldCollapseBelow={shouldCollapseBelow}
        shouldHideMetadata={shouldHideMetadata}
        containerElementRef={containerElementRef}
        getPreferredBadge={getPreferredBadge}
        platform={platform}
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
          id={id}
          conversationId={conversationId}
          interactionMode={reducedProps.interactionMode}
          i18n={i18n}
          isNextItemCallingNotification={isNextItemCallingNotification}
          onOutgoingAudioCallInConversation={onOutgoingAudioCallInConversation}
          onOutgoingVideoCallInConversation={onOutgoingVideoCallInConversation}
          toggleDeleteMessagesModal={reducedProps.toggleDeleteMessagesModal}
          returnToActiveCall={returnToActiveCall}
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
    } else if (item.type === 'contactRemovedNotification') {
      notification = (
        <SystemMessage
          icon="info"
          contents={i18n('icu:ContactRemovedNotification__text')}
        />
      );
    } else if (item.type === 'changeNumberNotification') {
      notification = (
        <ChangeNumberNotification
          {...reducedProps}
          {...item.data}
          i18n={i18n}
        />
      );
    } else if (item.type === 'joinedSignalNotification') {
      notification = (
        <JoinedSignalNotification
          {...reducedProps}
          {...item.data}
          i18n={i18n}
        />
      );
    } else if (item.type === 'titleTransitionNotification') {
      notification = (
        <TitleTransitionNotification
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
    } else if (item.type === 'phoneNumberDiscovery') {
      notification = (
        <PhoneNumberDiscoveryNotification
          {...reducedProps}
          {...item.data}
          i18n={i18n}
        />
      );
    } else if (item.type === 'resetSessionNotification') {
      notification = <ResetSessionNotification {...reducedProps} i18n={i18n} />;
    } else if (item.type === 'profileChange') {
      notification = (
        <ProfileChangeNotification
          {...reducedProps}
          {...item.data}
          i18n={i18n}
          onOpenEditNicknameAndNoteModal={onOpenEditNicknameAndNoteModal}
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
    } else if (item.type === 'messageRequestResponse') {
      notification = (
        <MessageRequestResponseNotification
          {...item.data}
          i18n={i18n}
          isGroup={isGroup}
          isBlocked={isBlocked}
          onOpenMessageRequestActionsConfirmation={
            onOpenMessageRequestActionsConfirmation
          }
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
        isTargeted={isTargeted}
        targetMessage={targetMessage}
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
});
