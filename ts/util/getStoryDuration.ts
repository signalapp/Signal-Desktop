// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentType } from '../types/Attachment';
import {
  hasFailed,
  hasNotResolved,
  isDownloaded,
  isGIF,
  isVideo,
} from '../types/Attachment';
import { count } from './grapheme';
import { SECOND } from './durations';

const DEFAULT_DURATION = 5 * SECOND;
const MAX_VIDEO_DURATION = 30 * SECOND;
const MIN_TEXT_DURATION = 3 * SECOND;

export async function getStoryDuration(
  attachment: AttachmentType
): Promise<number | undefined> {
  if (hasFailed(attachment)) {
    return DEFAULT_DURATION;
  }

  if (!isDownloaded(attachment) || hasNotResolved(attachment)) {
    return;
  }

  if (isGIF([attachment]) || isVideo([attachment])) {
    const videoEl = document.createElement('video');
    if (!attachment.url) {
      return DEFAULT_DURATION;
    }
    videoEl.src = attachment.url;

    await new Promise<void>(resolve => {
      function resolveAndRemove() {
        resolve();
        videoEl.removeEventListener('loadedmetadata', resolveAndRemove);
      }

      videoEl.addEventListener('loadedmetadata', resolveAndRemove);
    });

    const duration = Math.ceil(videoEl.duration * SECOND);

    if (isGIF([attachment])) {
      // GIFs: Loop gifs 3 times or play for 5 seconds, whichever is longer.
      return Math.min(
        Math.max(duration * 3, DEFAULT_DURATION),
        MAX_VIDEO_DURATION
      );
    }

    // Video max duration: 30 seconds
    return Math.min(duration, MAX_VIDEO_DURATION);
  }

  if (attachment.textAttachment && attachment.textAttachment.text) {
    // Minimum 3 seconds. +1 second for every 15 characters past the first
    // 15 characters (round up).
    // For text stories that include a link, +2 seconds to the playback time.
    const length = count(attachment.textAttachment.text);
    const additionalSeconds = (Math.ceil(length / 15) - 1) * SECOND;
    const linkPreviewSeconds = attachment.textAttachment.preview
      ? 2 * SECOND
      : 0;
    return MIN_TEXT_DURATION + additionalSeconds + linkPreviewSeconds;
  }

  return DEFAULT_DURATION;
}
