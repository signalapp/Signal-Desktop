// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent, ReactNode } from 'react';
import React from 'react';

import { ContactName } from './ContactName';
import { SystemMessage } from './SystemMessage';
import { Intl } from '../Intl';
import type { LocalizerType } from '../../types/Util';
import * as expirationTimer from '../../util/expirationTimer';
import * as log from '../../logging/log';

export type TimerNotificationType =
  | 'fromOther'
  | 'fromMe'
  | 'fromSync'
  | 'fromMember';

// We can't always use destructuring assignment because of the complexity of this props
//   type.
/* eslint-disable react/destructuring-assignment */
export type PropsData = {
  type: TimerNotificationType;
  title: string;
} & (
  | { disabled: true }
  | {
      disabled: false;
      expireTimer: number;
    }
);

type PropsHousekeeping = {
  i18n: LocalizerType;
};

export type Props = PropsData & PropsHousekeeping;

export const TimerNotification: FunctionComponent<Props> = props => {
  const { disabled, i18n, title, type } = props;

  let changeKey: string;
  let timespan: string;
  if (props.disabled) {
    changeKey = 'disabledDisappearingMessages';
    timespan = ''; // Set to the empty string to satisfy types
  } else {
    changeKey = 'theyChangedTheTimer';
    timespan = expirationTimer.format(i18n, props.expireTimer);
  }

  let message: ReactNode;
  switch (type) {
    case 'fromOther':
      message = (
        <Intl
          i18n={i18n}
          id={changeKey}
          components={{
            name: <ContactName key="external-1" title={title} />,
            time: timespan,
          }}
        />
      );
      break;
    case 'fromMe':
      message = disabled
        ? i18n('youDisabledDisappearingMessages')
        : i18n('youChangedTheTimer', [timespan]);
      break;
    case 'fromSync':
      message = disabled
        ? i18n('disappearingMessagesDisabled')
        : i18n('timerSetOnSync', [timespan]);
      break;
    case 'fromMember':
      message = disabled
        ? i18n('disappearingMessagesDisabledByMember')
        : i18n('timerSetByMember', [timespan]);
      break;
    default:
      log.warn('TimerNotification: unsupported type provided:', type);
      break;
  }

  const icon = disabled ? 'timer-disabled' : 'timer';

  return <SystemMessage icon={icon} contents={message} />;
};
