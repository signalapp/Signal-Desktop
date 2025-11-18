// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentType } from '../types/Attachment.std.js';
import type { LoggerType } from '../types/Logging.std.js';
import { getLocalAttachmentUrl } from './getLocalAttachmentUrl.std.js';
import { toLogFormat } from '../types/errors.std.js';

export async function captureAudioDuration(
  attachment: AttachmentType,
  {
    logger,
  }: {
    logger: LoggerType;
  }
): Promise<AttachmentType> {
  const audio = new window.Audio();
  audio.muted = true;
  audio.src = getLocalAttachmentUrl(attachment);

  try {
    await new Promise<void>((resolve, reject) => {
      audio.addEventListener('loadedmetadata', () => {
        resolve();
      });

      audio.addEventListener('error', event => {
        const error = new Error(
          `Failed to load audio from due to error: ${event.type}`
        );
        reject(error);
      });
    });
  } catch (error) {
    logger.warn(`captureAudioDuration failed ${toLogFormat(error)}`);
    return attachment;
  }

  if (!Number.isNaN(audio.duration)) {
    return {
      ...attachment,
      duration: audio.duration,
    };
  }

  return attachment;
}
