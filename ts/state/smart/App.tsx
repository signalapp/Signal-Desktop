// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { connect } from 'react-redux';

import type { VerificationTransport } from '../../types/VerificationTransport';
import { App } from '../../components/App';
import OS from '../../util/os/osMain';
import { strictAssert } from '../../util/assert';
import { SmartCallManager } from './CallManager';
import { SmartGlobalModalContainer } from './GlobalModalContainer';
import { SmartLightbox } from './Lightbox';
import { SmartStoryViewer } from './StoryViewer';
import type { StateType } from '../reducer';
import {
  getIntl,
  getLocaleMessages,
  getTheme,
  getIsMainWindowMaximized,
  getIsMainWindowFullScreen,
  getMenuOptions,
} from '../selectors/user';
import { hasSelectedStoryData } from '../selectors/stories';
import { getHideMenuBar } from '../selectors/items';
import { mapDispatchToProps } from '../actions';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { ModalContainer } from '../../components/ModalContainer';
import { SmartInbox } from './Inbox';

function renderInbox(): JSX.Element {
  return <SmartInbox />;
}

const mapStateToProps = (state: StateType) => {
  const i18n = getIntl(state);

  return {
    ...state.app,
    i18n,
    localeMessages: getLocaleMessages(state),
    isMaximized: getIsMainWindowMaximized(state),
    isFullScreen: getIsMainWindowFullScreen(state),
    menuOptions: getMenuOptions(state),
    OS: OS.getName(),
    osClassName: OS.getClassName(),
    hideMenuBar: getHideMenuBar(state),
    renderCallManager: () => (
      <ModalContainer className="module-calling__modal-container">
        <SmartCallManager />
      </ModalContainer>
    ),
    renderGlobalModalContainer: () => <SmartGlobalModalContainer />,
    renderLightbox: () => <SmartLightbox />,
    hasSelectedStoryData: hasSelectedStoryData(state),
    renderStoryViewer: (closeView: () => unknown) => (
      <ErrorBoundary name="App/renderStoryViewer" closeView={closeView}>
        <SmartStoryViewer />
      </ErrorBoundary>
    ),
    renderInbox,
    requestVerification: (
      number: string,
      captcha: string,
      transport: VerificationTransport
    ): Promise<{ sessionId: string }> => {
      const { server } = window.textsecure;
      strictAssert(server !== undefined, 'WebAPI not available');

      return server.requestVerification(number, captcha, transport);
    },
    registerSingleDevice: (
      number: string,
      code: string,
      sessionId: string
    ): Promise<void> => {
      return window
        .getAccountManager()
        .registerSingleDevice(number, code, sessionId);
    },
    theme: getTheme(state),

    toast: state.toast.toast,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartApp = smart(App);
