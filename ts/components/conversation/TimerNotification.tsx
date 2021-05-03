// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { FunctionComponent, ReactNode } from 'react';
import classNames from 'classnames';

import { ContactName } from './ContactName';
import { Intl } from '../Intl';
import { LocalizerType } from '../../types/Util';
import * as expirationTimer from '../../util/expirationTimer';

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
  phoneNumber?: string;
  profileName?: string;
  title: string;
  name?: string;
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
  const { disabled, i18n, name, phoneNumber, profileName, title, type } = props;

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
            name: (
              <ContactName
                key="external-1"
                phoneNumber={phoneNumber}
                profileName={profileName}
                title={title}
                name={name}
                i18n={i18n}
              />
            ),
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
      window.log.warn('TimerNotification: unsupported type provided:', type);
      break;
  }

  return (
    <div className="module-timer-notification">
      <div className="module-timer-notification__icon-container">
        <div
          className={classNames(
            'module-timer-notification__icon',
            disabled ? 'module-timer-notification__icon--disabled' : null
          )}
        />
        <div className="module-timer-notification__icon-label">{timespan}</div>
      </div>
      <div className="module-timer-notification__message">{message}</div>
    </div>
  );
};
