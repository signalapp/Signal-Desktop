// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Convert seconds to a string showing mm:ss or hh:mm:ss for displaying in an audio player
 */
export const durationToPlaybackText = (time: number): string => {
  const hours = Math.floor(time / 3600);
  let minutes = Math.floor((time % 3600) / 60).toString();
  let seconds = Math.floor(time % 60).toString();

  if (hours !== 0 && minutes.length < 2) {
    minutes = `0${minutes}`;
  }

  if (seconds.length < 2) {
    seconds = `0${seconds}`;
  }

  return hours ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
};
