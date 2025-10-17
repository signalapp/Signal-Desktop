// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { requestVerification as doRequestVerification } from '../../textsecure/WebAPI.preload.js';
import { accountManager } from '../../textsecure/AccountManager.preload.js';
import type { VerificationTransport } from '../../types/VerificationTransport.std.js';
import { DataWriter } from '../../sql/Client.preload.js';
import { App } from '../../components/App.preload.js';
import OS from '../../util/os/osMain.node.js';
import { getConversation } from '../../util/getConversation.preload.js';
import { getChallengeURL } from '../../challenge.dom.js';
import { writeProfile } from '../../services/writeProfile.preload.js';
import { challengeHandler } from '../../services/challengeHandler.preload.js';
import { SmartCallManager } from './CallManager.preload.js';
import { SmartGlobalModalContainer } from './GlobalModalContainer.preload.js';
import { SmartLightbox } from './Lightbox.preload.js';
import { SmartStoryViewer } from './StoryViewer.preload.js';
import {
  getIsMainWindowMaximized,
  getIsMainWindowFullScreen,
  getTheme,
} from '../selectors/user.std.js';
import { hasSelectedStoryData as getHasSelectedStoryData } from '../selectors/stories.preload.js';
import { useAppActions } from '../ducks/app.preload.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';
import { useStoriesActions } from '../ducks/stories.preload.js';
import { ErrorBoundary } from '../../components/ErrorBoundary.dom.js';
import { ModalContainer } from '../../components/ModalContainer.dom.js';
import { SmartInbox } from './Inbox.preload.js';
import { getApp } from '../selectors/app.std.js';
import { SmartFunProvider } from './FunProvider.preload.js';

function renderInbox(): JSX.Element {
  return <SmartInbox />;
}

function renderCallManager(): JSX.Element {
  return (
    <ModalContainer className="module-calling__modal-container">
      <SmartCallManager />
    </ModalContainer>
  );
}

function renderGlobalModalContainer(): JSX.Element {
  return <SmartGlobalModalContainer />;
}

function renderLightbox(): JSX.Element {
  return <SmartLightbox />;
}

function renderStoryViewer(closeView: () => unknown): JSX.Element {
  return (
    <ErrorBoundary name="App/renderStoryViewer" closeView={closeView}>
      <SmartStoryViewer />
    </ErrorBoundary>
  );
}

async function getCaptchaToken(): Promise<string> {
  const url = getChallengeURL('registration');
  document.location.href = url;
  return challengeHandler.requestCaptcha({
    reason: 'standalone registration',
  });
}

function requestVerification(
  number: string,
  captcha: string,
  transport: VerificationTransport
): Promise<{ sessionId: string }> {
  return doRequestVerification(number, captcha, transport);
}

function registerSingleDevice(
  number: string,
  code: string,
  sessionId: string
): Promise<void> {
  return accountManager.registerSingleDevice(number, code, sessionId);
}

function readyForUpdates(): void {
  window.IPC.readyForUpdates();
}

async function uploadProfile({
  firstName,
  lastName,
}: {
  firstName: string;
  lastName: string;
}): Promise<void> {
  const us = window.ConversationController.getOurConversationOrThrow();
  us.set({ profileName: firstName, profileFamilyName: lastName });
  us.captureChange('standaloneProfile');
  await DataWriter.updateConversation(us.attributes);

  await writeProfile(getConversation(us), {
    keepAvatar: true,
  });
}

export const SmartApp = memo(function SmartApp() {
  const state = useSelector(getApp);
  const isMaximized = useSelector(getIsMainWindowMaximized);
  const isFullScreen = useSelector(getIsMainWindowFullScreen);
  const hasSelectedStoryData = useSelector(getHasSelectedStoryData);
  const theme = useSelector(getTheme);

  const { openInbox } = useAppActions();
  const { scrollToMessage } = useConversationsActions();
  const { viewStory } = useStoriesActions();

  const osClassName = OS.getClassName();

  return (
    <SmartFunProvider>
      <App
        state={state}
        isMaximized={isMaximized}
        isFullScreen={isFullScreen}
        getCaptchaToken={getCaptchaToken}
        osClassName={osClassName}
        renderCallManager={renderCallManager}
        renderGlobalModalContainer={renderGlobalModalContainer}
        renderLightbox={renderLightbox}
        hasSelectedStoryData={hasSelectedStoryData}
        readyForUpdates={readyForUpdates}
        renderStoryViewer={renderStoryViewer}
        renderInbox={renderInbox}
        requestVerification={requestVerification}
        registerSingleDevice={registerSingleDevice}
        uploadProfile={uploadProfile}
        theme={theme}
        openInbox={openInbox}
        scrollToMessage={scrollToMessage}
        viewStory={viewStory}
      />
    </SmartFunProvider>
  );
});
