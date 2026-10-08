// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import classNames from 'classnames';

import type { LocalizerType } from '../../types/Util.std.ts';

type Color = 'light';

const COLOR_CLASSES: Record<Color, string> = {
  light: 'module-typing-animation__dot--light',
};

export type Props = {
  i18n: LocalizerType;
  color?: Color;
};

export function TypingAnimation({ i18n, color }: Props): JSX.Element {
  return (
    <div className="module-typing-animation" title={i18n('icu:typingAlt')}>
      <div
        className={classNames(
          'module-typing-animation__dot',
          'module-typing-animation__dot--first',
          color != null && COLOR_CLASSES[color]
        )}
      />
      <div className="module-typing-animation__spacer" />
      <div
        className={classNames(
          'module-typing-animation__dot',
          'module-typing-animation__dot--second',
          color != null && COLOR_CLASSES[color]
        )}
      />
      <div className="module-typing-animation__spacer" />
      <div
        className={classNames(
          'module-typing-animation__dot',
          'module-typing-animation__dot--third',
          color != null && COLOR_CLASSES[color]
        )}
      />
    </div>
  );
}
