// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import classNames from 'classnames';
import { noop } from 'lodash';
import type { ReactElement } from 'react';
import React, { useEffect, useState } from 'react';
import animationData from '../../images/lottie-animations/CallingSpeakingIndicator.json';
import { Lottie } from './Lottie';

const SPEAKING_LINGER_MS = 100;

const BASE_CLASS_NAME = 'CallingAudioIndicator';
const CONTENT_CLASS_NAME = `${BASE_CLASS_NAME}__content`;

export function CallingAudioIndicator({
  hasAudio,
  isSpeaking,
}: Readonly<{ hasAudio: boolean; isSpeaking: boolean }>): ReactElement {
  const [shouldShowSpeaking, setShouldShowSpeaking] = useState(isSpeaking);

  useEffect(() => {
    if (isSpeaking) {
      setShouldShowSpeaking(true);
    } else if (shouldShowSpeaking) {
      const timeout = setTimeout(() => {
        setShouldShowSpeaking(false);
      }, SPEAKING_LINGER_MS);
      return () => {
        clearTimeout(timeout);
      };
    }
    return noop;
  }, [isSpeaking, shouldShowSpeaking]);

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

  if (shouldShowSpeaking) {
    return (
      <div
        className={classNames(
          BASE_CLASS_NAME,
          `${BASE_CLASS_NAME}--with-content`
        )}
      >
        <Lottie animationData={animationData} className={CONTENT_CLASS_NAME} />
      </div>
    );
  }

  // Render an empty spacer so that names don't move around.
  return <div className={BASE_CLASS_NAME} />;
}
