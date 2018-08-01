import React from 'react';
import classNames from 'classnames';

import { ContactName } from './ContactName';
import { Intl } from '../Intl';
import { Localizer } from '../../types/Util';

import { missingCaseError } from '../../util/missingCaseError';

interface Props {
  type: 'fromOther' | 'fromMe' | 'fromSync';
  phoneNumber: string;
  profileName?: string;
  name?: string;
  disabled: boolean;
  timespan: string;
  i18n: Localizer;
}

export class TimerNotification extends React.Component<Props> {
  public renderContents() {
    const {
      i18n,
      name,
      phoneNumber,
      profileName,
      timespan,
      type,
      disabled,
    } = this.props;

    switch (type) {
      case 'fromOther':
        return (
          <Intl
            i18n={i18n}
            id={
              disabled ? 'disabledDisappearingMessages' : 'theyChangedTheTimer'
            }
            components={[
              <ContactName
                i18n={i18n}
                key="external-1"
                phoneNumber={phoneNumber}
                profileName={profileName}
                name={name}
              />,
              timespan,
            ]}
          />
        );
      case 'fromMe':
        return disabled
          ? i18n('youDisabledDisappearingMessages')
          : i18n('youChangedTheTimer', [timespan]);
      case 'fromSync':
        return disabled
          ? i18n('disappearingMessagesDisabled')
          : i18n('timerSetOnSync', [timespan]);
      default:
        throw missingCaseError(type);
    }
  }

  public render() {
    const { timespan, disabled } = this.props;

    return (
      <div className="module-timer-notification">
        <div className="module-timer-notification__icon-container">
          <div
            className={classNames(
              'module-timer-notification__icon',
              disabled ? 'module-timer-notification__icon--disabled' : null
            )}
          />
          <div className="module-timer-notification__icon-label">
            {timespan}
          </div>
        </div>
        <div className="module-timer-notification__message">
          {this.renderContents()}
        </div>
      </div>
    );
  }
}
