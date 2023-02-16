// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../types/Util';
import { Button } from './Button';

export type PropsType = Readonly<{
  i18n: LocalizerType;
  onNext: () => void;
}>;

const CLASS = 'UsernameOnboardingModalBody';

const SUPPORT_URL = 'https://support.signal.org/hc/articles/5389476324250';

export function UsernameOnboardingModalBody({
  i18n,
  onNext,
}: PropsType): JSX.Element {
  return (
    <div className={CLASS}>
      <div className={`${CLASS}__large-at`} />

      <div className={`${CLASS}__title`}>{i18n(`icu:${CLASS}__title`)}</div>

      <div className={`${CLASS}__row`}>
        <div className={`${CLASS}__row__icon ${CLASS}__row__icon--number`} />

        <div className={`${CLASS}__row__body`}>
          {i18n(`icu:${CLASS}__row__number`)}
        </div>
      </div>

      <div className={`${CLASS}__row`}>
        <div className={`${CLASS}__row__icon ${CLASS}__row__icon--link`} />

        <div className={`${CLASS}__row__body`}>
          {i18n(`icu:${CLASS}__row__link`)}
        </div>
      </div>

      <div className={`${CLASS}__row`}>
        <div className={`${CLASS}__row__icon ${CLASS}__row__icon--lock`} />

        <div className={`${CLASS}__row__body`}>
          {i18n(`icu:${CLASS}__row__lock`)}
        </div>
      </div>

      <div className={`${CLASS}__row ${CLASS}__row--center`}>
        <a
          className={`${CLASS}__learn-more`}
          href={SUPPORT_URL}
          rel="noreferrer"
          target="_blank"
        >
          {i18n(`icu:${CLASS}__learn-more`)}
        </a>
      </div>

      <Button className={`${CLASS}__submit`} onClick={onNext}>
        {i18n(`icu:${CLASS}__continue`)}
      </Button>
    </div>
  );
}
