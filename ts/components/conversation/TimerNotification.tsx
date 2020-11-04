import React from 'react';

import { ContactName } from './ContactName';
import { Intl } from '../Intl';

import { missingCaseError } from '../../util/missingCaseError';
import { SessionIcon, SessionIconSize, SessionIconType } from '../session/icon';

type Props = {
  type: 'fromOther' | 'fromMe' | 'fromSync';
  phoneNumber: string;
  profileName?: string;
  name?: string;
  disabled: boolean;
  timespan: string;
};

export const TimerNotification = (props: Props) => {
  function renderContents() {
    const { phoneNumber, profileName, timespan, type, disabled } = props;
    const changeKey = disabled
      ? 'disabledDisappearingMessages'
      : 'theyChangedTheTimer';

    const contact = (
      <span
        key={`external-${phoneNumber}`}
        className="module-timer-notification__contact"
      >
        {profileName || phoneNumber}
      </span>
    );

    switch (type) {
      case 'fromOther':
        return (
          <Intl
            i18n={window.i18n}
            id={changeKey}
            components={[contact, timespan]}
          />
        );
      case 'fromMe':
        return disabled
          ? window.i18n('youDisabledDisappearingMessages')
          : window.i18n('youChangedTheTimer', [timespan]);
      case 'fromSync':
        return disabled
          ? window.i18n('disappearingMessagesDisabled')
          : window.i18n('timerSetOnSync', [timespan]);
      default:
        throw missingCaseError(type);
    }
  }

  return (
    <div className="module-timer-notification">
      <div className="module-timer-notification__message">
        <div>
          <SessionIcon
            iconType={SessionIconType.Stopwatch}
            iconSize={SessionIconSize.Small}
            iconColor={'#ABABAB'}
          />
        </div>

        <div>{renderContents()}</div>
      </div>
    </div>
  );
};
