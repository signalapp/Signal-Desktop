// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ChallengeHandler } from '../challenge.dom.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';
import { sendChallengeResponse as doSendChallengeResponse } from '../textsecure/WebAPI.preload.ts';
import { conversationJobQueue } from '../jobs/conversationJobQueue.preload.ts';
import { ToastType } from '../types/Toast.dom.tsx';

export const challengeHandler = new ChallengeHandler({
  storage: itemStorage,

  startQueue(conversationId: string) {
    conversationJobQueue.resolveVerificationWaiter(conversationId);
  },

  requestChallenge(request) {
    if (window.SignalCI) {
      window.SignalCI.handleEvent('challenge', request);
      return;
    }
    window.sendChallengeRequest(request);
  },

  async sendChallengeResponse(data) {
    await doSendChallengeResponse(data);
  },

  onChallengeFailed() {
    // TODO: DESKTOP-1530
    // Display humanized `retryAfter`
    window.reduxActions.toast.showToast({
      toastType: ToastType.CaptchaFailed,
    });
  },

  onChallengeSolved() {
    window.reduxActions.toast.showToast({
      toastType: ToastType.CaptchaSolved,
    });
  },

  setChallengeStatus(challengeStatus) {
    window.reduxActions.network.setChallengeStatus(challengeStatus);
  },
});
