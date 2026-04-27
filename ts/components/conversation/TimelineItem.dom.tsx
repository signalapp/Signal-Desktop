// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode, RefObject } from 'react';
import React, { memo } from 'react';

import type { LocalizerType, ThemeType } from '../../types/Util.std.ts';
import type { GetSharedGroupNamesType } from '../../util/sharedGroupNames.dom.ts';

import type { InteractionModeType } from '../../state/ducks/conversations.preload.ts';
import { TimelineDateHeader } from './TimelineDateHeader.dom.tsx';
import type {
  Props as AllMessageProps,
  PropsData as TimelineMessageProps,
  PropsActions as MessageActionsType,
} from './TimelineMessage.dom.tsx';
import type { PropsActionsType as CallingNotificationActionsType } from './CallingNotification.dom.tsx';
import { CallingNotification } from './CallingNotification.dom.tsx';
import { ChatSessionRefreshedNotification } from './ChatSessionRefreshedNotification.dom.tsx';
import type { PropsDataType as DeliveryIssueProps } from './DeliveryIssueNotification.dom.tsx';
import { DeliveryIssueNotification } from './DeliveryIssueNotification.dom.tsx';
import type { PropsData as ChangeNumberNotificationProps } from './ChangeNumberNotification.dom.tsx';
import { ChangeNumberNotification } from './ChangeNumberNotification.dom.tsx';
import type { PropsData as JoinedSignalNotificationProps } from './JoinedSignalNotification.dom.tsx';
import { JoinedSignalNotification } from './JoinedSignalNotification.dom.tsx';
import type { PropsData as TitleTransitionNotificationProps } from './TitleTransitionNotification.dom.tsx';
import { TitleTransitionNotification } from './TitleTransitionNotification.dom.tsx';
import type { CallingNotificationType } from '../../util/callingNotification.std.ts';
import { InlineNotificationWrapper } from './InlineNotificationWrapper.dom.tsx';
import type { PropsData as UnsupportedMessageProps } from './UnsupportedMessage.dom.tsx';
import { UnsupportedMessage } from './UnsupportedMessage.dom.tsx';
import type { PropsData as TimerNotificationProps } from './TimerNotification.dom.tsx';
import { TimerNotification } from './TimerNotification.dom.tsx';
import type {
  PropsActions as SafetyNumberActionsType,
  PropsData as SafetyNumberNotificationProps,
} from './SafetyNumberNotification.dom.tsx';
import { SafetyNumberNotification } from './SafetyNumberNotification.dom.tsx';
import type { PropsData as VerificationNotificationProps } from './VerificationNotification.dom.tsx';
import { VerificationNotification } from './VerificationNotification.dom.tsx';
import type { PropsData as GroupNotificationProps } from './GroupNotification.dom.tsx';
import { GroupNotification } from './GroupNotification.dom.tsx';
import type {
  PropsDataType as GroupV2ChangeProps,
  PropsActionsType as GroupV2ChangeActionsType,
} from './GroupV2Change.dom.tsx';
import { GroupV2Change } from './GroupV2Change.dom.tsx';
import type { PropsDataType as GroupV1MigrationProps } from './GroupV1Migration.dom.tsx';
import { GroupV1Migration } from './GroupV1Migration.dom.tsx';
import type { SmartContactRendererType } from '../../groupChange.std.ts';
import { ResetSessionNotification } from './ResetSessionNotification.dom.tsx';
import type { PropsType as ProfileChangeNotificationPropsType } from './ProfileChangeNotification.dom.tsx';
import { ProfileChangeNotification } from './ProfileChangeNotification.dom.tsx';
import type { PropsType as PaymentEventNotificationPropsType } from './PaymentEventNotification.dom.tsx';
import { PaymentEventNotification } from './PaymentEventNotification.dom.tsx';
import type { PollTerminateNotificationDataType } from './PollTerminateNotification.dom.tsx';
import { PollTerminateNotification } from './PollTerminateNotification.dom.tsx';
import type { PropsDataType as ConversationMergeNotificationPropsType } from './ConversationMergeNotification.dom.tsx';
import { ConversationMergeNotification } from './ConversationMergeNotification.dom.tsx';
import type { PropsDataType as PhoneNumberDiscoveryNotificationPropsType } from './PhoneNumberDiscoveryNotification.dom.tsx';
import { PhoneNumberDiscoveryNotification } from './PhoneNumberDiscoveryNotification.dom.tsx';
import type { PinnedMessageNotificationData } from './pinned-messages/PinnedMessageNotification.dom.tsx';
import { PinnedMessageNotification } from './pinned-messages/PinnedMessageNotification.dom.tsx';
import { SystemMessage } from './SystemMessage.dom.tsx';
import { TimelineMessage } from './TimelineMessage.dom.tsx';
import {
  MessageRequestResponseNotification,
  type MessageRequestResponseNotificationData,
} from './MessageRequestResponseNotification.dom.tsx';
import type { MessageRequestState } from './MessageRequestActionsConfirmation.dom.tsx';
import type { MessageInteractivity } from './Message.dom.tsx';
import type { PinMessageData } from '../../model-types.d.ts';
import type { AciString } from '../../types/ServiceId.std.ts';
import type { RenderItemProps } from '../../state/smart/TimelineItem.preload.tsx';
import type { CollapseSet } from '../../util/CollapseSet.std.ts';
import { CollapseSetViewer } from './CollapseSet.dom.tsx';
import type { TargetedMessageType } from '../../state/selectors/conversations.dom.ts';

type CallHistoryType = {
  type: 'callHistory';
  data: CallingNotificationType;
};
type ChatSessionRefreshedType = {
  type: 'chatSessionRefreshed';
  data: null;
};
type CollapseSetType = {
  type: 'collapseSet';
  data: CollapseSet;
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
type PinnedMessageNotificationType = {
  type: 'pinnedMessage';
  data: PinnedMessageNotificationData;
};
type MessageRequestResponseNotificationType = {
  type: 'messageRequestResponse';
  data: MessageRequestResponseNotificationData;
};
type PollTerminateNotificationType = {
  type: 'pollTerminate';
  data: PollTerminateNotificationDataType;
};

export type TimelineItemType = (
  | CallHistoryType
  | ChangeNumberNotificationType
  | ChatSessionRefreshedType
  | CollapseSetType
  | ConversationMergeNotificationType
  | DeliveryIssueType
  | GroupNotificationType
  | GroupV1MigrationType
  | GroupV2ChangeType
  | JoinedSignalNotificationType
  | MessageType
  | PhoneNumberDiscoveryNotificationType
  | PollTerminateNotificationType
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
  | PinnedMessageNotificationType
  | MessageRequestResponseNotificationType
) & { timestamp: number };

type PropsLocalType = {
  containerElementRef: RefObject<HTMLElement | null>;
  conversationId: string;
  getSharedGroupNames: GetSharedGroupNamesType;
  item?: TimelineItemType;
  id: string;
  interactivity: MessageInteractivity;
  isBlocked: boolean;
  isGroup: boolean;
  isNextItemCallingNotification: boolean;
  isSelectMode: boolean;
  isSelected: boolean;
  isTargeted: boolean;
  scrollToPinnedMessage: (pinMessage: PinMessageData) => void;
  scrollToPollMessage: (
    pollAuthorAci: AciString,
    pollTimestamp: number,
    conversationId: string
  ) => unknown;
  targetMessage: (messageId: string, conversationId: string) => unknown;
  toggleSelectMessage: (
    conversationId: string,
    messageId: string,
    shift: boolean,
    selected: boolean
  ) => void;
  shouldRenderDateHeader: boolean;
  onOpenEditNicknameAndNoteModal: (contactId: string) => void;
  onOpenMessageRequestActionsConfirmation: (state: MessageRequestState) => void;
  platform: string;
  renderContact: SmartContactRendererType<React.JSX.Element>;
  renderUniversalTimerNotification: () => React.JSX.Element;
  renderItem: (props: RenderItemProps) => React.JSX.Element;
  i18n: LocalizerType;
  interactionMode: InteractionModeType;
  targetedMessage: TargetedMessageType | undefined;
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
  getSharedGroupNames,
  i18n,
  id,
  interactivity,
  isBlocked,
  isGroup,
  isNextItemCallingNotification,
  isSelectMode,
  isSelected,
  isTargeted,
  item,
  onOpenEditNicknameAndNoteModal,
  onOpenMessageRequestActionsConfirmation,
  onOutgoingAudioCallInConversation,
  onOutgoingVideoCallInConversation,
  platform,
  renderUniversalTimerNotification,
  returnToActiveCall,
  renderItem,
  scrollToPinnedMessage,
  scrollToPollMessage,
  targetMessage,
  setMessageToEdit,
  shouldCollapseAbove,
  shouldCollapseBelow,
  shouldHideMetadata,
  shouldRenderDateHeader,
  targetedMessage,
  theme,
  toggleSelectMessage,
  ...reducedProps
}: PropsType): React.JSX.Element | null {
  if (!item) {
    // This can happen under normal conditions.
    //
    // `<Timeline>` and `<TimelineItem>` are connected to Redux separately. If a
    //   timeline item is removed from Redux, `<TimelineItem>` might re-render before
    //   `<Timeline>` does, which means we'll try to render nothing. This should resolve
    //   itself quickly, as soon as `<Timeline>` re-renders.
    return null;
  }

  let itemContents: ReactNode;
  if (item.type === 'message') {
    itemContents = (
      <TimelineMessage
        {...reducedProps}
        {...item.data}
        interactivity={interactivity}
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
        toggleSelectMessage={toggleSelectMessage}
      />
    );
  } else if (item.type === 'collapseSet') {
    itemContents = (
      <CollapseSetViewer
        {...item.data}
        containerElementRef={containerElementRef}
        containerWidthBreakpoint={reducedProps.containerWidthBreakpoint}
        conversationId={conversationId}
        isBlocked={isBlocked}
        isGroup={isGroup}
        isSelectMode={isSelectMode}
        isSelected={isSelected}
        renderItem={renderItem}
        targetedMessage={targetedMessage}
        toggleDeleteMessagesModal={reducedProps.toggleDeleteMessagesModal}
        toggleSelectMessage={toggleSelectMessage}
        i18n={i18n}
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
          getSharedGroupNames={getSharedGroupNames}
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
    } else if (item.type === 'pinnedMessage') {
      notification = (
        <PinnedMessageNotification
          {...item.data}
          i18n={i18n}
          onScrollToPinnedMessage={scrollToPinnedMessage}
        />
      );
    } else if (item.type === 'pollTerminate') {
      notification = (
        <PollTerminateNotification
          {...reducedProps}
          {...item.data}
          i18n={i18n}
          scrollToPollMessage={scrollToPollMessage}
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
        isSelectMode={isSelectMode}
        isSelected={isSelected}
        targetMessage={targetMessage}
        toggleSelectMessage={toggleSelectMessage}
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
