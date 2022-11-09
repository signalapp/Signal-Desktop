// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { connect } from 'react-redux';
import type { MenuItemConstructorOptions } from 'electron';

import type { MenuActionType } from '../../types/menu';
import { App } from '../../components/App';
import { SmartCallManager } from './CallManager';
import { SmartCustomizingPreferredReactionsModal } from './CustomizingPreferredReactionsModal';
import { SmartGlobalModalContainer } from './GlobalModalContainer';
import { SmartLeftPane } from './LeftPane';
import { SmartStories } from './Stories';
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
import {
  hasSelectedStoryData,
  shouldShowStoriesView,
} from '../selectors/stories';
import { getHideMenuBar } from '../selectors/items';
import { getIsCustomizingPreferredReactions } from '../selectors/preferredReactions';
import { mapDispatchToProps } from '../actions';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { ModalContainer } from '../../components/ModalContainer';

const mapStateToProps = (state: StateType) => {
  const i18n = getIntl(state);

  return {
    ...state.app,
    i18n,
    localeMessages: getLocaleMessages(state),
    isCustomizingPreferredReactions: getIsCustomizingPreferredReactions(state),
    isMaximized: getIsMainWindowMaximized(state),
    isFullScreen: getIsMainWindowFullScreen(state),
    menuOptions: getMenuOptions(state),
    hasCustomTitleBar: window.SignalContext.OS.hasCustomTitleBar(),
    hideMenuBar: getHideMenuBar(state),
    renderCallManager: () => (
      <ModalContainer className="module-calling__modal-container">
        <SmartCallManager />
      </ModalContainer>
    ),
    renderCustomizingPreferredReactionsModal: () => (
      <SmartCustomizingPreferredReactionsModal />
    ),
    renderGlobalModalContainer: () => <SmartGlobalModalContainer />,
    renderLeftPane: () => <SmartLeftPane />,
    isShowingStoriesView: shouldShowStoriesView(state),
    renderStories: (closeView: () => unknown) => (
      <ErrorBoundary name="App/renderStories" closeView={closeView}>
        <SmartStories />
      </ErrorBoundary>
    ),
    hasSelectedStoryData: hasSelectedStoryData(state),
    renderStoryViewer: (closeView: () => unknown) => (
      <ErrorBoundary name="App/renderStoryViewer" closeView={closeView}>
        <SmartStoryViewer />
      </ErrorBoundary>
    ),
    requestVerification: (
      type: 'sms' | 'voice',
      number: string,
      token: string
    ): Promise<void> => {
      const accountManager = window.getAccountManager();

      if (type === 'sms') {
        return accountManager.requestSMSVerification(number, token);
      }

      return accountManager.requestVoiceVerification(number, token);
    },
    registerSingleDevice: (number: string, code: string): Promise<void> => {
      return window.getAccountManager().registerSingleDevice(number, code);
    },
    selectedConversationId: state.conversations.selectedConversationId,
    selectedMessage: state.conversations.selectedMessage,
    selectedMessageSource: state.conversations.selectedMessageSource,
    theme: getTheme(state),

    executeMenuRole: (role: MenuItemConstructorOptions['role']): void => {
      window.SignalContext.executeMenuRole(role);
    },
    executeMenuAction: (action: MenuActionType): void => {
      window.SignalContext.executeMenuAction(action);
    },
    titleBarDoubleClick: (): void => {
      window.titleBarDoubleClick();
    },
    toast: state.toast.toast,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartApp = smart(App);
