// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ChallengeHandler } from '../challenge.dom.js';
import { itemStorage } from '../textsecure/Storage.preload.js';
import { sendChallengeResponse as doSendChallengeResponse } from '../textsecure/WebAPI.preload.js';
import { conversationJobQueue } from '../jobs/conversationJobQueue.preload.js';
import { ToastType } from '../types/Toast.dom.js';

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
