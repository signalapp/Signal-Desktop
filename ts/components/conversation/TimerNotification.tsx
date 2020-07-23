import React from 'react';

import { ContactName } from './ContactName';
import { Intl } from '../Intl';
import { LocalizerType } from '../../types/Util';

import { missingCaseError } from '../../util/missingCaseError';
import { SessionIcon, SessionIconSize, SessionIconType } from '../session/icon';

interface Props {
  type: 'fromOther' | 'fromMe' | 'fromSync';
  phoneNumber: string;
  profileName?: string;
  name?: string;
  disabled: boolean;
  timespan: string;
  i18n: LocalizerType;
}

export class TimerNotification extends React.Component<Props> {
  public renderContents() {
    const {
      i18n,
      phoneNumber,
      profileName,
      timespan,
      type,
      disabled,
    } = this.props;
    const changeKey = disabled
      ? 'disabledDisappearingMessages'
      : 'theyChangedTheTimer';

    const displayedPubkey = profileName
      ? window.shortenPubkey(phoneNumber)
      : phoneNumber;

    switch (type) {
      case 'fromOther':
        return (
          <Intl
            i18n={i18n}
            id={changeKey}
            components={[
              <ContactName
                i18n={i18n}
                key="external-1"
                phoneNumber={displayedPubkey}
                profileName={profileName}
                name={name}
                module="module-message__author"
                boldProfileName={true}
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

          <div>{this.renderContents()}</div>
        </div>
      </div>
    );
  }
}
