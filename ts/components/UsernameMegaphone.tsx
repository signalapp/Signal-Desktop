// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { LocalizerType } from '../types/Util';
import type { UsernameOnboardingActionableMegaphoneType } from '../types/Megaphone';
import { Button, ButtonSize, ButtonVariant } from './Button';

export type PropsType = {
  i18n: LocalizerType;
} & Omit<UsernameOnboardingActionableMegaphoneType, 'type'>;

export function UsernameMegaphone({
  i18n,
  onLearnMore,
  onDismiss,
}: PropsType): JSX.Element {
  return (
    <div className="UsernameMegaphone">
      <div className="UsernameMegaphone__row">
        <i className="UsernameMegaphone__row__icon" />

        <div className="UsernameMegaphone__row__text">
          <h2>{i18n('icu:UsernameMegaphone__title')}</h2>
          <p>{i18n('icu:UsernameMegaphone__body')}</p>
        </div>
      </div>

      <div className="UsernameMegaphone__buttons">
        <Button
          className="UsernameMegaphone__buttons__button"
          variant={ButtonVariant.SecondaryAffirmative}
          size={ButtonSize.Small}
          onClick={onDismiss}
        >
          {i18n('icu:UsernameMegaphone__dismiss')}
        </Button>

        <Button
          className="UsernameMegaphone__buttons__button"
          variant={ButtonVariant.SecondaryAffirmative}
          size={ButtonSize.Small}
          onClick={onLearnMore}
        >
          {i18n('icu:UsernameMegaphone__learn-more')}
        </Button>
      </div>
    </div>
  );
}
