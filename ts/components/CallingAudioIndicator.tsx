// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import React from 'react';
import animationData from '../../images/lottie-animations/CallingSpeakingIndicator.json';
import { Lottie } from './Lottie';

export function CallingAudioIndicator({
  hasRemoteAudio,
  isSpeaking,
}: Readonly<{
  hasRemoteAudio: boolean;
  isSpeaking: boolean;
}>): ReactElement {
  if (!hasRemoteAudio) {
    return (
      <div className="CallingAudioIndicator CallingAudioIndicator--muted" />
    );
  }

  if (isSpeaking) {
    return (
      <Lottie animationData={animationData} className="CallingAudioIndicator" />
    );
  }

  // Render an empty spacer so that names don't move around.
  return <div className="CallingAudioIndicator" />;
}
