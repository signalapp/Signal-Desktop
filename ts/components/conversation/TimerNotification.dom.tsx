// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React from 'react';

import { ContactName } from './ContactName.dom.js';
import { SystemMessage } from './SystemMessage.dom.js';
import { I18n } from '../I18n.dom.js';
import type { LocalizerType } from '../../types/Util.std.js';
import * as expirationTimer from '../../util/expirationTimer.std.js';
import type { DurationInSeconds } from '../../util/durations/index.std.js';
import { createLogger } from '../../logging/log.std.js';

const log = createLogger('TimerNotification');

export type TimerNotificationType =
  | 'fromOther'
  | 'fromMe'
  | 'fromSync'
  | 'fromMember';

// We can't always use destructuring assignment because of the complexity of this props
//   type.

export type PropsData = {
  type: TimerNotificationType;
  title: string;
} & (
  | { disabled: true }
  | {
      disabled: false;
      expireTimer: DurationInSeconds;
    }
);

type PropsHousekeeping = {
  i18n: LocalizerType;
};

export type Props = PropsData & PropsHousekeeping;

export function TimerNotification(props: Props): JSX.Element {
  const { disabled, i18n, title, type } = props;

  let timespan: string;
  if (disabled) {
    timespan = ''; // Set to the empty string to satisfy types
  } else {
    timespan = expirationTimer.format(i18n, props.expireTimer);
  }

  const name = <ContactName key="external-1" title={title} />;

  let message: ReactNode;
  switch (type) {
    case 'fromOther':
      message = disabled ? (
        <I18n
          i18n={i18n}
          id="icu:disabledDisappearingMessages"
          components={{ name }}
        />
      ) : (
        <I18n
          i18n={i18n}
          id="icu:theyChangedTheTimer"
          components={{ name, time: timespan }}
        />
      );
      break;
    case 'fromMe':
      message = disabled
        ? i18n('icu:youDisabledDisappearingMessages')
        : i18n('icu:youChangedTheTimer', { time: timespan });
      break;
    case 'fromSync':
      message = disabled
        ? i18n('icu:disappearingMessagesDisabled')
        : i18n('icu:timerSetOnSync', { time: timespan });
      break;
    case 'fromMember':
      message = disabled
        ? i18n('icu:disappearingMessagesDisabledByMember')
        : i18n('icu:timerSetByMember', { time: timespan });
      break;
    default:
      log.warn('unsupported type provided:', type);
      break;
  }

  const icon = disabled ? 'timer-disabled' : 'timer';

  return <SystemMessage icon={icon} contents={message} />;
}
