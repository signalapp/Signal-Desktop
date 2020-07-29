import React from 'react';
import { LocalizerType } from '../../types/Util';

import {
  Message,
  Props as AllMessageProps,
  PropsActions as MessageActionsType,
  PropsData as MessageProps,
} from './Message';

import {
  CallingNotification,
  PropsData as CallingNotificationProps,
} from './CallingNotification';
import { InlineNotificationWrapper } from './InlineNotificationWrapper';
import {
  PropsActions as UnsupportedMessageActionsType,
  PropsData as UnsupportedMessageProps,
  UnsupportedMessage,
} from './UnsupportedMessage';
import {
  PropsData as TimerNotificationProps,
  TimerNotification,
} from './TimerNotification';
import {
  PropsActions as SafetyNumberActionsType,
  PropsData as SafetyNumberNotificationProps,
  SafetyNumberNotification,
} from './SafetyNumberNotification';
import {
  PropsData as VerificationNotificationProps,
  VerificationNotification,
} from './VerificationNotification';
import {
  GroupNotification,
  PropsData as GroupNotificationProps,
} from './GroupNotification';
import { ResetSessionNotification } from './ResetSessionNotification';
import {
  ProfileChangeNotification,
  PropsType as ProfileChangeNotificationPropsType,
} from './ProfileChangeNotification';

type CallHistoryType = {
  type: 'callHistory';
  data: CallingNotificationProps;
};
type LinkNotificationType = {
  type: 'linkNotification';
  data: null;
};
type MessageType = {
  type: 'message';
  data: MessageProps;
};
type UnsupportedMessageType = {
  type: 'unsupportedMessage';
  data: UnsupportedMessageProps;
};
type TimerNotificationType = {
  type: 'timerNotification';
  data: TimerNotificationProps;
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
type ResetSessionNotificationType = {
  type: 'resetSessionNotification';
  data: null;
};
type ProfileChangeNotificationType = {
  type: 'profileChange';
  data: ProfileChangeNotificationPropsType;
};

export type TimelineItemType =
  | CallHistoryType
  | GroupNotificationType
  | LinkNotificationType
  | MessageType
  | ProfileChangeNotificationType
  | ResetSessionNotificationType
  | SafetyNumberNotificationType
  | TimerNotificationType
  | UnsupportedMessageType
  | VerificationNotificationType;

type PropsLocalType = {
  conversationId: string;
  conversationAccepted: boolean;
  item?: TimelineItemType;
  id: string;
  isSelected: boolean;
  selectMessage: (messageId: string, conversationId: string) => unknown;
  i18n: LocalizerType;
};

type PropsActionsType = MessageActionsType &
  UnsupportedMessageActionsType &
  SafetyNumberActionsType;

export type PropsType = PropsLocalType &
  PropsActionsType &
  Pick<AllMessageProps, 'renderEmojiPicker'>;

export class TimelineItem extends React.PureComponent<PropsType> {
  public render() {
    const {
      conversationId,
      id,
      isSelected,
      item,
      i18n,
      selectMessage,
    } = this.props;

    if (!item) {
      // tslint:disable-next-line:no-console
      console.warn(`TimelineItem: item ${id} provided was falsey`);

      return null;
    }

    if (item.type === 'message') {
      return <Message {...this.props} {...item.data} i18n={i18n} />;
    }

    let notification;

    if (item.type === 'unsupportedMessage') {
      notification = (
        <UnsupportedMessage {...this.props} {...item.data} i18n={i18n} />
      );
    } else if (item.type === 'callHistory') {
      notification = <CallingNotification i18n={i18n} {...item.data} />;
    } else if (item.type === 'linkNotification') {
      notification = (
        <div className="module-message-unsynced">
          <div className="module-message-unsynced__icon" />
          {i18n('messageHistoryUnsynced')}
        </div>
      );
    } else if (item.type === 'timerNotification') {
      notification = (
        <TimerNotification {...this.props} {...item.data} i18n={i18n} />
      );
    } else if (item.type === 'safetyNumberNotification') {
      notification = (
        <SafetyNumberNotification {...this.props} {...item.data} i18n={i18n} />
      );
    } else if (item.type === 'verificationNotification') {
      notification = (
        <VerificationNotification {...this.props} {...item.data} i18n={i18n} />
      );
    } else if (item.type === 'groupNotification') {
      notification = (
        <GroupNotification {...this.props} {...item.data} i18n={i18n} />
      );
    } else if (item.type === 'resetSessionNotification') {
      notification = (
        <ResetSessionNotification {...this.props} {...item.data} i18n={i18n} />
      );
    } else if (item.type === 'profileChange') {
      notification = (
        <ProfileChangeNotification {...this.props} {...item.data} i18n={i18n} />
      );
    } else {
      throw new Error('TimelineItem: Unknown type!');
    }

    return (
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
}
