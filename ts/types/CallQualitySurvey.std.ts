// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CallEndReason } from '@signalapp/ringrtc';

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace CallQualitySurvey {
  // IMPORTANT: These strings need to be the same across clients
  export enum Issue {
    AUDIO = 'audio',
    AUDIO_STUTTERING = 'audio_stuttering',
    AUDIO_LOCAL_ECHO = 'audio_local_echo',
    AUDIO_REMOTE_ECHO = 'audio_remote_echo',
    AUDIO_DROP = 'audio_drop',
    VIDEO = 'video',
    VIDEO_NO_CAMERA = 'video_no_camera',
    VIDEO_LOW_QUALITY = 'video_low_quality',
    VIDEO_LOW_RESOLUTION = 'video_low_resolution',
    CALL_DROPPED = 'call_dropped',
    OTHER = 'other',
  }

  export enum CallType {
    DIRECT_VOICE = 'direct_voice',
    DIRECT_VIDEO = 'direct_video',
    GROUP = 'group',
    CALL_LINK = 'call_link',
  }

  export type Request = Readonly<{
    userSatisfied: boolean;
    callQualityIssues: ReadonlyArray<Issue>;
    additionalIssuesDescription: string;
    debugLogUrl: string | null;
    startTimestamp: number;
    endTimestamp: number;
    callType: CallType;
    success: boolean;
    callEndReason: CallEndReason;
    rttMedian: number | null;
    jitterMedian: number | null;
    packetLossFraction: number | null;
    callTelemetry: Uint8Array | null;
  }>;

  export type Form = Readonly<{
    userSatisfied: boolean;
    callQualityIssues: ReadonlySet<Issue>;
    additionalIssuesDescription: string;
    shareDebugLog: boolean;
  }>;
}
