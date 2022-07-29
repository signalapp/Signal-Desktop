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
import { SmartSafetyNumberViewer } from './SafetyNumberViewer';
import { SmartStories } from './Stories';
import { SmartStoryViewer } from './StoryViewer';
import type { StateType } from '../reducer';
import { getPreferredBadgeSelector } from '../selectors/badges';
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
import { getConversationsStoppingSend } from '../selectors/conversations';
import { getIsCustomizingPreferredReactions } from '../selectors/preferredReactions';
import { mapDispatchToProps } from '../actions';
import type { SafetyNumberProps } from '../../components/SafetyNumberChangeDialog';
import { ErrorBoundary } from '../../components/ErrorBoundary';

const mapStateToProps = (state: StateType) => {
  const i18n = getIntl(state);

  return {
    ...state.app,
    conversationsStoppingSend: getConversationsStoppingSend(state),
    getPreferredBadge: getPreferredBadgeSelector(state),
    i18n,
    localeMessages: getLocaleMessages(state),
    isCustomizingPreferredReactions: getIsCustomizingPreferredReactions(state),
    isMaximized: getIsMainWindowMaximized(state),
    isFullScreen: getIsMainWindowFullScreen(state),
    menuOptions: getMenuOptions(state),
    hasCustomTitleBar: window.SignalContext.OS.hasCustomTitleBar(),
    hideMenuBar: getHideMenuBar(state),
    renderCallManager: () => <SmartCallManager />,
    renderCustomizingPreferredReactionsModal: () => (
      <SmartCustomizingPreferredReactionsModal />
    ),
    renderGlobalModalContainer: () => <SmartGlobalModalContainer />,
    renderLeftPane: () => <SmartLeftPane />,
    renderSafetyNumber: (props: SafetyNumberProps) => (
      <SmartSafetyNumberViewer {...props} />
    ),
    isShowingStoriesView: shouldShowStoriesView(state),
    renderStories: () => (
      <ErrorBoundary>
        <SmartStories />
      </ErrorBoundary>
    ),
    hasSelectedStoryData: hasSelectedStoryData(state),
    renderStoryViewer: () => (
      <ErrorBoundary>
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
    toastType: state.toast.toastType,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartApp = smart(App);
