// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import type { VerificationTransport } from '../../types/VerificationTransport.js';
import { DataWriter } from '../../sql/Client.js';
import { App } from '../../components/App.js';
import OS from '../../util/os/osMain.js';
import { getConversation } from '../../util/getConversation.js';
import { getChallengeURL } from '../../challenge.js';
import { writeProfile } from '../../services/writeProfile.js';
import { strictAssert } from '../../util/assert.js';
import { SmartCallManager } from './CallManager.js';
import { SmartGlobalModalContainer } from './GlobalModalContainer.js';
import { SmartLightbox } from './Lightbox.js';
import { SmartStoryViewer } from './StoryViewer.js';
import {
  getIsMainWindowMaximized,
  getIsMainWindowFullScreen,
  getTheme,
} from '../selectors/user.js';
import { hasSelectedStoryData as getHasSelectedStoryData } from '../selectors/stories.js';
import { useAppActions } from '../ducks/app.js';
import { useConversationsActions } from '../ducks/conversations.js';
import { useStoriesActions } from '../ducks/stories.js';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';
import { ModalContainer } from '../../components/ModalContainer.js';
import { SmartInbox } from './Inbox.js';
import { getApp } from '../selectors/app.js';
import { SmartFunProvider } from './FunProvider.js';

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
  if (!window.Signal.challengeHandler) {
    throw new Error('Captcha handler is not ready!');
  }
  return window.Signal.challengeHandler.requestCaptcha({
    reason: 'standalone registration',
  });
}

function requestVerification(
  number: string,
  captcha: string,
  transport: VerificationTransport
): Promise<{ sessionId: string }> {
  const { server } = window.textsecure;
  strictAssert(server !== undefined, 'WebAPI not available');
  return server.requestVerification(number, captcha, transport);
}

function registerSingleDevice(
  number: string,
  code: string,
  sessionId: string
): Promise<void> {
  return window
    .getAccountManager()
    .registerSingleDevice(number, code, sessionId);
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
