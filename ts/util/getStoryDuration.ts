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
import * as log from '../logging/log';
import * as Errors from '../types/errors';

const DEFAULT_DURATION = 5 * SECOND;
const MAX_VIDEO_DURATION = 30 * SECOND;

export async function getStoryDuration(
  attachment: AttachmentType
): Promise<number | undefined> {
  if (hasFailed(attachment)) {
    return DEFAULT_DURATION;
  }

  if (attachment.textAttachment) {
    // Minimum 5 seconds. +1 second for every 15 characters past the first
    // 15 characters (round up).
    // For text stories that include a link, +2 seconds to the playback time.
    const length = attachment.textAttachment.text
      ? count(attachment.textAttachment.text)
      : 0;
    const additionalSeconds = (Math.ceil(length / 15) - 1) * SECOND;
    const linkPreviewSeconds = attachment.textAttachment.preview
      ? 2 * SECOND
      : 0;
    return DEFAULT_DURATION + additionalSeconds + linkPreviewSeconds;
  }

  if (!isDownloaded(attachment) || hasNotResolved(attachment)) {
    return;
  }

  if (isGIF([attachment]) || isVideo([attachment])) {
    const videoEl = document.createElement('video');
    const { url } = attachment;

    if (!url) {
      return DEFAULT_DURATION;
    }

    let duration: number;
    try {
      duration = await new Promise<number>((resolve, reject) => {
        function resolveAndRemove() {
          resolve(videoEl.duration * SECOND);
          videoEl.removeEventListener('loadedmetadata', resolveAndRemove);
        }

        videoEl.addEventListener('loadedmetadata', resolveAndRemove);
        videoEl.addEventListener('error', () => {
          reject(videoEl.error ?? new Error('Failed to load'));
        });

        videoEl.src = url;
      });
    } catch (error) {
      log.error(
        'getStoryDuration: Failed to load video duration',
        Errors.toLogFormat(error)
      );
      return DEFAULT_DURATION;
    } finally {
      // Stop loading video
      videoEl.pause();
      videoEl.removeAttribute('src'); // empty source
      videoEl.load();
    }

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

  if (attachment.caption) {
    const length = count(attachment.caption);
    const additionalSeconds = (Math.ceil(length / 15) - 1) * SECOND;
    return DEFAULT_DURATION + additionalSeconds;
  }

  return DEFAULT_DURATION;
}
