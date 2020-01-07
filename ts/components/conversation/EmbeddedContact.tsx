import React from 'react';
import classNames from 'classnames';

import { ContactType } from '../../types/Contact';

import { LocalizerType } from '../../types/Util';
import {
  renderAvatar,
  renderContactShorthand,
  renderName,
} from './_contactUtil';

interface Props {
  contact: ContactType;
  i18n: LocalizerType;
  isIncoming: boolean;
  withContentAbove: boolean;
  withContentBelow: boolean;
  tabIndex: number;
  onClick?: () => void;
}

export class EmbeddedContact extends React.Component<Props> {
  public render() {
    const {
      contact,
      i18n,
      isIncoming,
      onClick,
      tabIndex,
      withContentAbove,
      withContentBelow,
    } = this.props;
    const module = 'embedded-contact';
    const direction = isIncoming ? 'incoming' : 'outgoing';

    return (
      <button
        className={classNames(
          'module-embedded-contact',
          `module-embedded-contact--${direction}`,
          withContentAbove
            ? 'module-embedded-contact--with-content-above'
            : null,
          withContentBelow
            ? 'module-embedded-contact--with-content-below'
            : null
        )}
        onKeyDown={(event: React.KeyboardEvent) => {
          if (event.key !== 'Enter' && event.key !== 'Space') {
            return;
          }

          if (onClick) {
            event.stopPropagation();
            event.preventDefault();

            onClick();
          }
        }}
        onClick={(event: React.MouseEvent) => {
          if (onClick) {
            event.stopPropagation();
            event.preventDefault();

            onClick();
          }
        }}
        tabIndex={tabIndex}
      >
        {renderAvatar({ contact, i18n, size: 52, direction })}
        <div className="module-embedded-contact__text-container">
          {renderName({ contact, isIncoming, module })}
          {renderContactShorthand({ contact, isIncoming, module })}
        </div>
      </button>
    );
  }
}
