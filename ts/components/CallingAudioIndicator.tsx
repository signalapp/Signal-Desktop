// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import classNames from 'classnames';
import { noop } from 'lodash';
import type { ReactElement } from 'react';
import React, { useEffect, useState } from 'react';
import animationData from '../../images/lottie-animations/CallingSpeakingIndicator.json';
import { Lottie } from './Lottie';

const SPEAKING_LINGER_MS = 100;
const SPEAKING_BACKGROUND_LINGER_MS = 500;

const BASE_CLASS_NAME = 'CallingAudioIndicator';
const CONTENT_CLASS_NAME = `${BASE_CLASS_NAME}__content`;

enum SpeakingState {
  None = 'None',
  Speaking = 'Speaking',
  BackgroundOnly = 'BackgroundOnly',
}

export function CallingAudioIndicator({
  hasAudio,
  isSpeaking,
}: Readonly<{ hasAudio: boolean; isSpeaking: boolean }>): ReactElement {
  const [speakingState, setSpeakingState] = useState(
    isSpeaking ? SpeakingState.Speaking : SpeakingState.None
  );

  useEffect(() => {
    if (isSpeaking) {
      setSpeakingState(SpeakingState.Speaking);
      return noop;
    }

    if (speakingState === SpeakingState.None) {
      return noop;
    }

    let timeout: NodeJS.Timeout;
    if (speakingState === SpeakingState.Speaking) {
      timeout = setTimeout(() => {
        setSpeakingState(SpeakingState.BackgroundOnly);
      }, SPEAKING_LINGER_MS);
    } else if (speakingState === SpeakingState.BackgroundOnly) {
      timeout = setTimeout(() => {
        setSpeakingState(SpeakingState.None);
      }, SPEAKING_BACKGROUND_LINGER_MS);
    }

    return () => {
      clearTimeout(timeout);
    };
  }, [isSpeaking, speakingState]);

  if (!hasAudio) {
    return (
      <div
        className={classNames(
          BASE_CLASS_NAME,
          `${BASE_CLASS_NAME}--with-content`
        )}
      >
        <div
          className={classNames(
            CONTENT_CLASS_NAME,
            `${CONTENT_CLASS_NAME}--muted`
          )}
        />
      </div>
    );
  }

  if (speakingState !== SpeakingState.None) {
    let maybeAnimation: React.ReactElement | undefined;
    if (speakingState === SpeakingState.Speaking) {
      maybeAnimation = (
        <Lottie animationData={animationData} className={CONTENT_CLASS_NAME} />
      );
    }

    return (
      <div
        className={classNames(
          BASE_CLASS_NAME,
          `${BASE_CLASS_NAME}--with-content`
        )}
      >
        {maybeAnimation}
      </div>
    );
  }

  // Render an empty spacer so that names don't move around.
  return <div className={BASE_CLASS_NAME} />;
}
