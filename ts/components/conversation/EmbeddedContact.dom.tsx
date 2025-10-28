// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';
import type { ReadonlyDeep } from 'type-fest';

import type { EmbeddedContactForUIType } from '../../types/EmbeddedContact.std.js';

import type { LocalizerType } from '../../types/Util.std.js';
import {
  renderAvatar,
  renderContactShorthand,
  renderName,
} from './contactUtil.dom.js';

export type Props = {
  contact: ReadonlyDeep<EmbeddedContactForUIType>;
  i18n: LocalizerType;
  isIncoming: boolean;
  onClick?: () => void;
  tabIndex: number;
  withContentAbove: boolean;
  withContentBelow: boolean;
};

export function EmbeddedContact(props: Props): JSX.Element {
  const {
    contact,
    i18n,
    isIncoming,
    onClick,
    tabIndex,
    withContentAbove,
    withContentBelow,
  } = props;
  const module = 'embedded-contact';
  const direction = isIncoming ? 'incoming' : 'outgoing';

  return (
    <div
      className={classNames(
        'module-embedded-contact',
        `module-embedded-contact--${direction}`,
        withContentAbove ? 'module-embedded-contact--with-content-above' : null,
        withContentBelow ? 'module-embedded-contact--with-content-below' : null
      )}
    >
      <button
        type="button"
        className="module-embedded-contact__avatar-container"
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
        {renderAvatar({ contact, direction, i18n, size: 52 })}
      </button>
      <div className="module-embedded-contact__text-container">
        {renderName({ contact, isIncoming, module })}
        {renderContactShorthand({ contact, isIncoming, module })}
      </div>
    </div>
  );
}
