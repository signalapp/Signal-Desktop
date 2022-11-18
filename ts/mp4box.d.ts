// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

declare module 'mp4box' {
  type MP4MediaTrack = {
    alternate_group: number;
    bitrate: number;
    codec: string;
    created: Date;
    duration: number;
    id: number;
    language: string;
    layer: number;
    modified: Date;
    movie_duration: number;
    nb_samples: number;
    timescale: number;
    track_height: number;
    track_width: number;
    volume: number;
  };

  type MP4VideoData = {
    height: number;
    width: number;
  };

  type MP4VideoTrack = MP4MediaTrack & {
    video: MP4VideoData;
  };

  type MP4AudioData = {
    channel_count: number;
    sample_rate: number;
    sample_size: number;
  };

  type MP4AudioTrack = MP4MediaTrack & {
    audio: MP4AudioData;
  };

  type MP4Track = MP4VideoTrack | MP4AudioTrack;

  type MP4Info = {
    brands: Array<string>;
    created: Date;
    duration: number;
    fragment_duration: number;
    hasIOD: boolean;
    isFragmented: boolean;
    isProgressive: boolean;
    mime: string;
    modified: Date;
    timescale: number;
    tracks: Array<MP4Track>;
  };

  export type MP4ArrayBuffer = ArrayBuffer & { fileStart: number };

  export type MP4File = {
    appendBuffer(data: MP4ArrayBuffer): number;
    flush(): void;
    onError?: (e: string) => void;
    onReady?: (info: MP4Info) => void;
  };

  export function createFile(): MP4File;
}
