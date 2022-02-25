// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { noop } from 'lodash';
import type { ReactElement } from 'react';
import React, { useEffect, useState } from 'react';
import animationData from '../../images/lottie-animations/CallingSpeakingIndicator.json';
import { Lottie } from './Lottie';

const SPEAKING_LINGER_MS = 100;

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
      <div className="CallingAudioIndicator CallingAudioIndicator--muted" />
    );
  }

  if (shouldShowSpeaking) {
    return (
      <Lottie animationData={animationData} className="CallingAudioIndicator" />
    );
  }

  // Render an empty spacer so that names don't move around.
  return <div className="CallingAudioIndicator" />;
}
