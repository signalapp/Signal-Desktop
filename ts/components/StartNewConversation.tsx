import React from 'react';
import classNames from 'classnames';

import { LocalizerType } from '../types/Util';
import { validateNumber } from '../types/PhoneNumber';

export interface Props {
  phoneNumber: string;
  i18n: LocalizerType;
  onClick: () => void;
}

export class StartNewConversation extends React.PureComponent<Props> {
  public render() {
    const { phoneNumber, i18n, onClick } = this.props;

    const error = validateNumber(phoneNumber, i18n);
    const avatar = error ? '!' : '#';
    const click = error ? undefined : onClick;

    return (
      <div
        role="button"
        className={classNames(
          'module-start-new-conversation',
          !error && 'valid'
        )}
        onClick={click}
      >
        <div className="module-start-new-conversation__avatar">{avatar}</div>
        <div className="module-start-new-conversation__content">
          <div className="module-start-new-conversation__number">
            {phoneNumber}
          </div>
          <div className="module-start-new-conversation__text">
            {error || i18n('startConversation')}
          </div>
        </div>
      </div>
    );
  }
}
