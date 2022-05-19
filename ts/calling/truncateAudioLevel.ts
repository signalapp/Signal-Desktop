// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// See https://github.com/signalapp/Signal-Android/blob/b527b2ffb94fb82a7508c3b33ddbffef28085349/app/src/main/java/org/thoughtcrime/securesms/events/CallParticipant.kt#L87-L100
const LOWEST = 500 / 32767;
const LOW = 1000 / 32767;
const MEDIUM = 5000 / 32767;
const HIGH = 16000 / 32767;

export function truncateAudioLevel(audioLevel: number): number {
  if (audioLevel < LOWEST) {
    return 0;
  }
  if (audioLevel < LOW) {
    return 0.25;
  }
  if (audioLevel < MEDIUM) {
    return 0.5;
  }
  if (audioLevel < HIGH) {
    return 0.75;
  }
  return 1;
}
