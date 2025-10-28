// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import MP4Box from 'mp4box';
import { VIDEO_MP4, isVideo } from '../types/MIME.std.js';
import {
  KIBIBYTE,
  getRenderDetailsForLimit,
} from '../types/AttachmentSize.std.js';
import { explodePromise } from './explodePromise.std.js';

const MAX_VIDEO_DURATION_IN_SEC = 30;

type MP4ArrayBuffer = ArrayBuffer & { fileStart: number };

export enum ReasonVideoNotGood {
  AllGoodNevermind = 'AllGoodNevermind',
  CouldNotReadFile = 'CouldNotReadFile',
  TooLong = 'TooLong',
  TooBig = 'TooBig',
  UnsupportedCodec = 'UnsupportedCodec',
  UnsupportedContainer = 'UnsupportedContainer',
}

function createMp4ArrayBuffer(src: ArrayBuffer): MP4ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(src.byteLength);
  new Uint8Array(arrayBuffer).set(new Uint8Array(src));

  (arrayBuffer as MP4ArrayBuffer).fileStart = 0;
  return arrayBuffer as MP4ArrayBuffer;
}

export type IsVideoGoodForStoriesResultType = Readonly<
  | {
      reason: Exclude<
        ReasonVideoNotGood,
        ReasonVideoNotGood.TooLong | ReasonVideoNotGood.TooBig
      >;
    }
  | {
      reason: ReasonVideoNotGood.TooLong;
      maxDurationInSec: number;
    }
  | {
      reason: ReasonVideoNotGood.TooBig;
      renderDetails: ReturnType<typeof getRenderDetailsForLimit>;
    }
>;

export type IsVideoGoodForStoriesOptionsType = Readonly<{
  maxAttachmentSizeInKb: number;
}>;

export async function isVideoGoodForStories(
  file: File,
  { maxAttachmentSizeInKb }: IsVideoGoodForStoriesOptionsType
): Promise<IsVideoGoodForStoriesResultType> {
  if (!isVideo(file.type)) {
    return { reason: ReasonVideoNotGood.AllGoodNevermind };
  }

  if (file.type !== VIDEO_MP4) {
    return { reason: ReasonVideoNotGood.UnsupportedContainer };
  }

  let src: ArrayBuffer;

  {
    const { promise, resolve } = explodePromise<ArrayBuffer | undefined>();

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        resolve(reader.result as ArrayBuffer);
      } else {
        resolve(undefined);
      }
    };
    reader.readAsArrayBuffer(file);

    const maybeSrc = await promise;
    if (maybeSrc === undefined) {
      return { reason: ReasonVideoNotGood.CouldNotReadFile };
    }

    src = maybeSrc;
  }

  if (src.byteLength / KIBIBYTE > maxAttachmentSizeInKb) {
    return {
      reason: ReasonVideoNotGood.TooBig,
      renderDetails: getRenderDetailsForLimit(maxAttachmentSizeInKb),
    };
  }

  const arrayBuffer = createMp4ArrayBuffer(src);

  const { promise, resolve } =
    explodePromise<IsVideoGoodForStoriesResultType>();

  const mp4 = MP4Box.createFile();
  mp4.onReady = info => {
    // mp4box returns a `duration` in `timescale` units
    const seconds = info.duration / info.timescale;

    if (seconds > MAX_VIDEO_DURATION_IN_SEC) {
      resolve({
        reason: ReasonVideoNotGood.TooLong,
        maxDurationInSec: MAX_VIDEO_DURATION_IN_SEC,
      });
      return;
    }

    const codecs = /codecs="([\w,.]+)"/.exec(info.mime);
    if (!codecs || !codecs[1]) {
      resolve({ reason: ReasonVideoNotGood.UnsupportedCodec });
      return;
    }

    const isH264 = codecs[1].split(',').some(codec => codec.startsWith('avc1'));

    if (!isH264) {
      resolve({ reason: ReasonVideoNotGood.UnsupportedCodec });
      return;
    }

    resolve({ reason: ReasonVideoNotGood.AllGoodNevermind });
  };
  mp4.appendBuffer(arrayBuffer);
  try {
    return await promise;
  } finally {
    mp4.flush();
  }
}
