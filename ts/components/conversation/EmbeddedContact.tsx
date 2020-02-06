import React from 'react';
import classNames from 'classnames';

import { Contact } from '../../types/Contact';

import { LocalizerType } from '../../types/Util';
import {
  renderAvatar,
  renderContactShorthand,
  renderName,
} from './_contactUtil';

interface Props {
  contact: Contact;
  hasSignalAccount: boolean;
  i18n: LocalizerType;
  isIncoming: boolean;
  withContentAbove: boolean;
  withContentBelow: boolean;
  onClick?: () => void;
}

export class EmbeddedContact extends React.Component<Props> {
  public render() {
    const {
      contact,
      i18n,
      isIncoming,
      onClick,
      withContentAbove,
      withContentBelow,
    } = this.props;
    const module = 'embedded-contact';
    const direction = isIncoming ? 'incoming' : 'outgoing';

    return (
      <div
        className={classNames(
          'module-embedded-contact',
          withContentAbove
            ? 'module-embedded-contact--with-content-above'
            : null,
          withContentBelow
            ? 'module-embedded-contact--with-content-below'
            : null
        )}
        role="button"
        onClick={onClick}
      >
        {renderAvatar({ contact, i18n, size: 36, direction })}
        <div className="module-embedded-contact__text-container">
          {renderName({ contact, isIncoming, module })}
          {renderContactShorthand({ contact, isIncoming, module })}
        </div>
      </div>
    );
  }
}
