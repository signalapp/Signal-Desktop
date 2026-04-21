// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo } from 'react';

import { DataWriter } from '../../sql/Client.preload.ts';
import { getConversation } from '../../util/getConversation.preload.ts';
import { writeProfile } from '../../services/writeProfile.preload.ts';
import { useAppActions } from '../ducks/app.preload.ts';
import { requestVerification as doRequestVerification } from '../../textsecure/WebAPI.preload.ts';
import { accountManager } from '../../textsecure/AccountManager.preload.ts';
import { getChallengeURL } from '../../challenge.dom.ts';
import { challengeHandler } from '../../services/challengeHandler.preload.ts';
import { useSelector } from 'react-redux';
import { getIntl, getUserConversationId } from '../selectors/user.std.ts';
import { StandaloneRegistration } from '../../components/StandaloneRegistration.dom.tsx';

import type { VerificationTransport } from '../../types/VerificationTransport.std.ts';
import { useConversationsActions } from '../ducks/conversations.preload.ts';
import { getMe } from '../selectors/conversations.dom.ts';

export const SmartStandaloneRegistration = memo(
  function SmartStandaloneRegistration() {
    const { openInbox } = useAppActions();
    const { deleteAvatarFromDisk, replaceAvatar, saveAvatarToDisk } =
      useConversationsActions();

    const i18n = useSelector(getIntl);
    const conversationId = useSelector(getUserConversationId);
    const me = useSelector(getMe);
    const userAvatarData = me?.avatars ?? [];

    const onComplete = () => {
      window.IPC.removeSetupMenuItems();
      openInbox();
    };

    return (
      <StandaloneRegistration
        conversationId={conversationId}
        deleteAvatarFromDisk={deleteAvatarFromDisk}
        getCaptchaToken={getCaptchaToken}
        i18n={i18n}
        onComplete={onComplete}
        readyForUpdates={readyForUpdates}
        registerSingleDevice={registerSingleDevice}
        replaceAvatar={replaceAvatar}
        requestVerification={requestVerification}
        saveAvatarToDisk={saveAvatarToDisk}
        uploadInitialProfile={uploadInitialProfile}
        userAvatarData={userAvatarData}
      />
    );
  }
);

async function getCaptchaToken(): Promise<string> {
  const url = getChallengeURL('registration');
  document.location.href = url;
  return challengeHandler.requestCaptcha({
    reason: 'standalone registration',
  });
}

function readyForUpdates(): void {
  window.IPC.readyForUpdates();
}

function registerSingleDevice(
  number: string,
  code: string,
  sessionId: string
): Promise<void> {
  return accountManager.registerSingleDevice(number, code, sessionId);
}

function requestVerification(
  number: string,
  captcha: string,
  transport: VerificationTransport
): Promise<{ sessionId: string }> {
  return doRequestVerification(number, captcha, transport);
}

async function uploadInitialProfile({
  firstName,
  lastName,
  avatarData,
}: {
  firstName: string;
  lastName: string;
  avatarData: Uint8Array<ArrayBuffer>;
}): Promise<void> {
  const us = window.ConversationController.getOurConversationOrThrow();
  us.set({ profileName: firstName, profileFamilyName: lastName });
  us.captureChange('standaloneProfile');
  await DataWriter.updateConversation(us.attributes);

  await writeProfile(getConversation(us), {
    keepAvatar: false,
    avatarUpdate: {
      oldAvatar: undefined,
      newAvatar: avatarData,
    },
  });
}
