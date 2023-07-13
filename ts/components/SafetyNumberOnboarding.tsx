// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useRef } from 'react';
import Lottie from 'lottie-react';
import type { LottieRefCurrentProps } from 'lottie-react';

import { Button, ButtonVariant } from './Button';
import { Intl } from './Intl';
import type { LocalizerType } from '../types/Util';
import { SAFETY_NUMBER_MIGRATION_URL } from '../types/support';
import { useReducedMotion } from '../hooks/useReducedMotion';
import animationData from '../../images/safety-number-onboarding.json';
import reducedAnimationData from '../../images/safety-number-onboarding-reduced-motion.json';

export type PropsType = {
  i18n: LocalizerType;
  onClose: () => void;
};

export function SafetyNumberOnboarding({
  i18n,
  onClose,
}: PropsType): JSX.Element | null {
  const isMotionReduced = useReducedMotion();
  const lottieRef = useRef<LottieRefCurrentProps | null>(null);

  const onDOMLoaded = useCallback(() => {
    if (isMotionReduced) {
      lottieRef.current?.goToAndPlay(0);
      return;
    }

    lottieRef.current?.playSegments(
      [
        [0, 360],
        [60, 360],
      ],
      true
    );
  }, [isMotionReduced]);

  return (
    <div className="module-SafetyNumberOnboarding">
      <h2>
        <Intl i18n={i18n} id="icu:SafetyNumberOnboarding__title" />
      </h2>
      <p>
        <Intl i18n={i18n} id="icu:SafetyNumberOnboarding__p1" />
      </p>
      <p>
        <Intl i18n={i18n} id="icu:SafetyNumberOnboarding__p2" />
      </p>
      <Lottie
        lottieRef={lottieRef}
        animationData={isMotionReduced ? reducedAnimationData : animationData}
        onDOMLoaded={onDOMLoaded}
      />
      <div className="module-SafetyNumberOnboarding__help">
        <a
          key="signal-support"
          href={SAFETY_NUMBER_MIGRATION_URL}
          rel="noreferrer"
          target="_blank"
        >
          <Intl i18n={i18n} id="icu:SafetyNumberOnboarding__help" />
        </a>
      </div>
      <Button
        className="module-SafetyNumberOnboarding__close"
        onClick={onClose}
        variant={ButtonVariant.Primary}
      >
        <Intl i18n={i18n} id="icu:SafetyNumberOnboarding__close" />
      </Button>
    </div>
  );
}
