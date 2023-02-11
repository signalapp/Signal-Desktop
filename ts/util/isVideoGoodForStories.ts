// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import MP4Box from 'mp4box';
import { VIDEO_MP4, isVideo } from '../types/MIME';
import { SECOND } from './durations';

const MAX_VIDEO_DURATION = 30 * SECOND;

type MP4ArrayBuffer = ArrayBuffer & { fileStart: number };

export enum ReasonVideoNotGood {
  AllGoodNevermind = 'AllGoodNevermind',
  CouldNotReadFile = 'CouldNotReadFile',
  TooLong = 'TooLong',
  UnsupportedCodec = 'UnsupportedCodec',
  UnsupportedContainer = 'UnsupportedContainer',
}

function createMp4ArrayBuffer(src: ArrayBuffer): MP4ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(src.byteLength);
  new Uint8Array(arrayBuffer).set(new Uint8Array(src));

  (arrayBuffer as MP4ArrayBuffer).fileStart = 0;
  return arrayBuffer as MP4ArrayBuffer;
}

export async function isVideoGoodForStories(
  file: File
): Promise<ReasonVideoNotGood> {
  if (!isVideo(file.type)) {
    return ReasonVideoNotGood.AllGoodNevermind;
  }

  if (file.type !== VIDEO_MP4) {
    return ReasonVideoNotGood.UnsupportedContainer;
  }

  try {
    const src = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result) {
          resolve(reader.result as ArrayBuffer);
        } else {
          reject(ReasonVideoNotGood.CouldNotReadFile);
        }
      };
      reader.readAsArrayBuffer(file);
    });

    const arrayBuffer = createMp4ArrayBuffer(src);

    const mp4 = MP4Box.createFile();
    await new Promise<void>((resolve, reject) => {
      mp4.onReady = info => {
        // mp4box returns a `duration` in `timescale` units
        const seconds = info.duration / info.timescale;
        const milliseconds = seconds * 1000;

        if (milliseconds > MAX_VIDEO_DURATION) {
          reject(ReasonVideoNotGood.TooLong);
          return;
        }

        const codecs = /codecs="([\w,.]+)"/.exec(info.mime);
        if (!codecs || !codecs[1]) {
          reject(ReasonVideoNotGood.UnsupportedCodec);
          return;
        }

        const isH264 = codecs[1]
          .split(',')
          .some(codec => codec.startsWith('avc1'));

        if (!isH264) {
          reject(ReasonVideoNotGood.UnsupportedCodec);
          return;
        }

        resolve();
      };
      mp4.appendBuffer(arrayBuffer);
    });
    mp4.flush();

    return ReasonVideoNotGood.AllGoodNevermind;
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }
    return err;
  }
}
