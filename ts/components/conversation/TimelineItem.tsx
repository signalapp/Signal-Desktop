// Copyright 2019-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactChild, RefObject } from 'react';
import React from 'react';

import type { LocalizerType, ThemeType } from '../../types/Util';

import type { InteractionModeType } from '../../state/ducks/conversations';
import { TimelineDateHeader } from './TimelineDateHeader';
import type {
  Props as AllMessageProps,
  PropsActions as MessageActionsType,
  PropsData as MessageProps,
} from './Message';
import { Message } from './Message';
import type { PropsActionsType as CallingNotificationActionsType } from './CallingNotification';
import { CallingNotification } from './CallingNotification';
import type { PropsActionsType as PropsChatSessionRefreshedActionsType } from './ChatSessionRefreshedNotification';
import { ChatSessionRefreshedNotification } from './ChatSessionRefreshedNotification';
import type {
  PropsActionsType as DeliveryIssueActionProps,
  PropsDataType as DeliveryIssueProps,
} from './DeliveryIssueNotification';
import { DeliveryIssueNotification } from './DeliveryIssueNotification';
import type { PropsData as ChangeNumberNotificationProps } from './ChangeNumberNotification';
import { ChangeNumberNotification } from './ChangeNumberNotification';
import type { CallingNotificationType } from '../../util/callingNotification';
import { InlineNotificationWrapper } from './InlineNotificationWrapper';
import type {
  PropsActions as UnsupportedMessageActionsType,
  PropsData as UnsupportedMessageProps,
} from './UnsupportedMessage';
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
import type { FullJSXType } from '../Intl';

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
  data: Omit<MessageProps, 'renderingContext'>;
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

export type TimelineItemType = (
  | CallHistoryType
  | ChatSessionRefreshedType
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
  | ChangeNumberNotificationType
  | UnsupportedMessageType
  | VerificationNotificationType
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
  DeliveryIssueActionProps &
  GroupV2ChangeActionsType &
  PropsChatSessionRefreshedActionsType &
  UnsupportedMessageActionsType &
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
        <Message
          {...this.props}
          {...item.data}
          shouldCollapseAbove={shouldCollapseAbove}
          shouldCollapseBelow={shouldCollapseBelow}
          shouldHideMetadata={shouldHideMetadata}
          containerElementRef={containerElementRef}
          getPreferredBadge={getPreferredBadge}
          i18n={i18n}
          theme={theme}
          renderingContext="conversation/TimelineItem"
        />
      );
    } else {
      let notification;

      if (item.type === 'unsupportedMessage') {
        notification = (
          <UnsupportedMessage {...this.props} {...item.data} i18n={i18n} />
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
          <ChatSessionRefreshedNotification
            {...this.props}
            {...item.data}
            i18n={i18n}
          />
        );
      } else if (item.type === 'deliveryIssue') {
        notification = (
          <DeliveryIssueNotification
            {...item.data}
            {...this.props}
            i18n={i18n}
          />
        );
      } else if (item.type === 'timerNotification') {
        notification = (
          <TimerNotification {...this.props} {...item.data} i18n={i18n} />
        );
      } else if (item.type === 'universalTimerNotification') {
        notification = renderUniversalTimerNotification();
      } else if (item.type === 'changeNumberNotification') {
        notification = (
          <ChangeNumberNotification
            {...this.props}
            {...item.data}
            i18n={i18n}
          />
        );
      } else if (item.type === 'safetyNumberNotification') {
        notification = (
          <SafetyNumberNotification
            {...this.props}
            {...item.data}
            i18n={i18n}
          />
        );
      } else if (item.type === 'verificationNotification') {
        notification = (
          <VerificationNotification
            {...this.props}
            {...item.data}
            i18n={i18n}
          />
        );
      } else if (item.type === 'groupNotification') {
        notification = (
          <GroupNotification {...this.props} {...item.data} i18n={i18n} />
        );
      } else if (item.type === 'groupV2Change') {
        notification = (
          <GroupV2Change {...this.props} {...item.data} i18n={i18n} />
        );
      } else if (item.type === 'groupV1Migration') {
        notification = (
          <GroupV1Migration {...this.props} {...item.data} i18n={i18n} />
        );
      } else if (item.type === 'resetSessionNotification') {
        notification = (
          <ResetSessionNotification
            {...this.props}
            {...item.data}
            i18n={i18n}
          />
        );
      } else if (item.type === 'profileChange') {
        notification = (
          <ProfileChangeNotification
            {...this.props}
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
