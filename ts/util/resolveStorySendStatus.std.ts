// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { StorySendStateType } from '../types/Stories.std.js';
import { ResolvedSendStatus } from '../types/Stories.std.js';
import {
  isFailed,
  isPending,
  isSent,
} from '../messages/MessageSendState.std.js';
import { softAssert } from './assert.std.js';

export function resolveStorySendStatus(
  sendStates: Array<StorySendStateType>
): ResolvedSendStatus {
  let anyPending = false;
  let anySent = false;
  let anyFailed = false;

  sendStates.forEach(({ status }) => {
    if (isPending(status)) {
      anyPending = true;
    }

    if (isSent(status)) {
      anySent = true;
    }

    if (isFailed(status)) {
      anyFailed = true;
    }
  });

  if (anyPending) {
    return ResolvedSendStatus.Sending;
  }

  if (anyFailed && anySent) {
    return ResolvedSendStatus.PartiallySent;
  }

  if (!anyFailed && anySent) {
    return ResolvedSendStatus.Sent;
  }

  if (anyFailed && !anySent) {
    return ResolvedSendStatus.Failed;
  }

  // Shouldn't get to this case but if none have been sent and none have failed
  // then let's assume that we've sent.
  softAssert(
    anySent && sendStates.length,
    'resolveStorySendStatus no sends, no failures, nothing pending?'
  );
  return ResolvedSendStatus.Sent;
}

export function reduceStorySendStatus(
  currentSendStatus: ResolvedSendStatus,
  nextSendStatus: ResolvedSendStatus
): ResolvedSendStatus {
  if (
    currentSendStatus === ResolvedSendStatus.Sending ||
    nextSendStatus === ResolvedSendStatus.Sending
  ) {
    return ResolvedSendStatus.Sending;
  }

  if (
    currentSendStatus === ResolvedSendStatus.Failed ||
    nextSendStatus === ResolvedSendStatus.Failed
  ) {
    return ResolvedSendStatus.Failed;
  }

  if (
    currentSendStatus === ResolvedSendStatus.PartiallySent ||
    nextSendStatus === ResolvedSendStatus.PartiallySent
  ) {
    return ResolvedSendStatus.PartiallySent;
  }

  return ResolvedSendStatus.Sent;
}
