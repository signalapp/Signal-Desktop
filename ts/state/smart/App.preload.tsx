// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { requestVerification as doRequestVerification } from '../../textsecure/WebAPI.preload.ts';
import { accountManager } from '../../textsecure/AccountManager.preload.ts';
import type { VerificationTransport } from '../../types/VerificationTransport.std.ts';
import { DataWriter } from '../../sql/Client.preload.ts';
import { App } from '../../components/App.dom.tsx';
import OS from '../../util/os/osMain.node.ts';
import { getConversation } from '../../util/getConversation.preload.ts';
import { getChallengeURL } from '../../challenge.dom.ts';
import { writeProfile } from '../../services/writeProfile.preload.ts';
import { challengeHandler } from '../../services/challengeHandler.preload.ts';
import { SmartCallManager } from './CallManager.preload.tsx';
import { SmartGlobalModalContainer } from './GlobalModalContainer.preload.tsx';
import { SmartLightbox } from './Lightbox.preload.tsx';
import { SmartStoryViewer } from './StoryViewer.preload.tsx';
import {
  getIsMainWindowMaximized,
  getIsMainWindowFullScreen,
  getTheme,
} from '../selectors/user.std.ts';
import { hasSelectedStoryData as getHasSelectedStoryData } from '../selectors/stories.preload.ts';
import { useAppActions } from '../ducks/app.preload.ts';
import { useConversationsActions } from '../ducks/conversations.preload.ts';
import { useStoriesActions } from '../ducks/stories.preload.ts';
import { ErrorBoundary } from '../../components/ErrorBoundary.dom.tsx';
import { ModalContainer } from '../../components/ModalContainer.dom.tsx';
import { SmartInbox } from './Inbox.preload.tsx';
import { SmartInstallScreen } from './InstallScreen.preload.tsx';
import { getApp } from '../selectors/app.std.ts';
import { SmartFunProvider } from './FunProvider.preload.tsx';

function renderInbox(): React.JSX.Element {
  return <SmartInbox />;
}

function renderCallManager(): React.JSX.Element {
  return (
    <ModalContainer className="module-calling__modal-container">
      <SmartCallManager />
    </ModalContainer>
  );
}

function renderGlobalModalContainer(): React.JSX.Element {
  return <SmartGlobalModalContainer />;
}

function renderInstallScreen(): React.JSX.Element {
  return <SmartInstallScreen />;
}

function renderLightbox(): React.JSX.Element {
  return <SmartLightbox />;
}

function renderStoryViewer(closeView: () => unknown): React.JSX.Element {
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
        renderInstallScreen={renderInstallScreen}
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
