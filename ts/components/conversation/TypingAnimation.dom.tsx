// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';

import type { LocalizerType } from '../../types/Util.std.js';

export type Props = {
  i18n: LocalizerType;
  color?: string;
};

export function TypingAnimation({ i18n, color }: Props): JSX.Element {
  return (
    <div className="module-typing-animation" title={i18n('icu:typingAlt')}>
      <div
        className={classNames(
          'module-typing-animation__dot',
          'module-typing-animation__dot--first',
          color ? `module-typing-animation__dot--${color}` : null
        )}
      />
      <div className="module-typing-animation__spacer" />
      <div
        className={classNames(
          'module-typing-animation__dot',
          'module-typing-animation__dot--second',
          color ? `module-typing-animation__dot--${color}` : null
        )}
      />
      <div className="module-typing-animation__spacer" />
      <div
        className={classNames(
          'module-typing-animation__dot',
          'module-typing-animation__dot--third',
          color ? `module-typing-animation__dot--${color}` : null
        )}
      />
    </div>
  );
}
