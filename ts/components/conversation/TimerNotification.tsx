import React from 'react';
import classNames from 'classnames';

import { ContactName } from './ContactName';
import { Intl } from '../Intl';
import { LocalizerType } from '../../types/Util';

export type TimerNotificationType =
  | 'fromOther'
  | 'fromMe'
  | 'fromSync'
  | 'fromMember';

export type PropsData = {
  type: TimerNotificationType;
  phoneNumber?: string;
  profileName?: string;
  title: string;
  name?: string;
  disabled: boolean;
  timespan: string;
};

type PropsHousekeeping = {
  i18n: LocalizerType;
};

export type Props = PropsData & PropsHousekeeping;

export class TimerNotification extends React.Component<Props> {
  public renderContents(): JSX.Element | string | null {
    const {
      i18n,
      name,
      phoneNumber,
      profileName,
      title,
      timespan,
      type,
      disabled,
    } = this.props;
    const changeKey = disabled
      ? 'disabledDisappearingMessages'
      : 'theyChangedTheTimer';

    switch (type) {
      case 'fromOther':
        return (
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
      case 'fromMe':
        return disabled
          ? i18n('youDisabledDisappearingMessages')
          : i18n('youChangedTheTimer', [timespan]);
      case 'fromSync':
        return disabled
          ? i18n('disappearingMessagesDisabled')
          : i18n('timerSetOnSync', [timespan]);
      case 'fromMember':
        return disabled
          ? i18n('disappearingMessagesDisabledByMember')
          : i18n('timerSetByMember', [timespan]);
      default:
        window.log.warn('TimerNotification: unsupported type provided:', type);

        return null;
    }
  }

  public render(): JSX.Element {
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
