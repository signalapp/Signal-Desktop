import React from 'react';
import { LocalizerType } from '../../types/Util';

import {
  Message,
  PropsActions as MessageActionsType,
  PropsData as MessageProps,
} from './Message';
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

type MessageType = {
  type: 'message';
  data: MessageProps;
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

type PropsData = {
  item:
    | MessageType
    | TimerNotificationType
    | SafetyNumberNotificationType
    | VerificationNotificationType
    | ResetSessionNotificationType
    | GroupNotificationType;
};

type PropsHousekeeping = {
  i18n: LocalizerType;
};

type PropsActions = MessageActionsType & SafetyNumberActionsType;

type Props = PropsData & PropsHousekeeping & PropsActions;

export class TimelineItem extends React.PureComponent<Props> {
  public render() {
    const { item, i18n } = this.props;

    if (!item) {
      throw new Error('TimelineItem: Item was not provided!');
    }

    if (item.type === 'message') {
      return <Message {...this.props} {...item.data} i18n={i18n} />;
    }
    if (item.type === 'timerNotification') {
      return <TimerNotification {...this.props} {...item.data} i18n={i18n} />;
    }
    if (item.type === 'safetyNumberNotification') {
      return (
        <SafetyNumberNotification {...this.props} {...item.data} i18n={i18n} />
      );
    }
    if (item.type === 'verificationNotification') {
      return (
        <VerificationNotification {...this.props} {...item.data} i18n={i18n} />
      );
    }
    if (item.type === 'groupNotification') {
      return <GroupNotification {...this.props} {...item.data} i18n={i18n} />;
    }
    if (item.type === 'resetSessionNotification') {
      return (
        <ResetSessionNotification {...this.props} {...item.data} i18n={i18n} />
      );
    }

    throw new Error('TimelineItem: Unknown type!');
  }
}
