// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import type { AnyActionableMegaphone } from '../../types/Megaphone';
import { MegaphoneType } from '../../types/Megaphone';
import { UsernameOnboardingState } from '../../types/globalModals';
import OS from '../../util/os/osMain';
import { drop } from '../../util/drop';
import { getIntl } from '../selectors/user';
import {
  getGlobalModalsState,
  isShowingAnyModal as getIsShowingAnyModal,
} from '../selectors/globalModals';
import { hasSelectedStoryData } from '../selectors/stories';
import { shouldShowLightbox } from '../selectors/lightbox';
import { isInFullScreenCall as getIsInFullScreenCall } from '../selectors/calling';
import { getSelectedNavTab } from '../selectors/nav';
import { getMe, getSelectedConversationId } from '../selectors/conversations';
import { useConversationsActions } from '../ducks/conversations';
import { useToastActions } from '../ducks/toast';
import { useGlobalModalActions } from '../ducks/globalModals';
import { NavTab } from '../ducks/nav';
import { getHasCompletedUsernameOnboarding } from '../selectors/items';
import { ToastManager } from '../../components/ToastManager';
import type { WidthBreakpoint } from '../../components/_util';
import { getToast } from '../selectors/toast';

export type SmartPropsType = Readonly<{
  disableMegaphone?: boolean;
  containerWidthBreakpoint: WidthBreakpoint;
}>;

function handleShowDebugLog() {
  window.IPC.showDebugLog();
}

export const SmartToastManager = memo(function SmartToastManager({
  disableMegaphone = false,
  containerWidthBreakpoint,
}: SmartPropsType) {
  const i18n = useSelector(getIntl);
  const hasCompletedUsernameOnboarding = useSelector(
    getHasCompletedUsernameOnboarding
  );
  const toast = useSelector(getToast);
  const globalModals = useSelector(getGlobalModalsState);
  const isShowingAnyModal = useSelector(getIsShowingAnyModal);
  const isShowingStory = useSelector(hasSelectedStoryData);
  const isShowingLightbox = useSelector(shouldShowLightbox);
  const isInFullScreenCall = useSelector(getIsInFullScreenCall);
  const { username } = useSelector(getMe);
  const selectedNavTab = useSelector(getSelectedNavTab);
  const selectedConversationId = useSelector(getSelectedConversationId);

  const { onUndoArchive } = useConversationsActions();
  const { openFileInFolder, hideToast } = useToastActions();
  const { showAttachmentNotAvailableModal, toggleUsernameOnboarding } =
    useGlobalModalActions();

  let megaphone: AnyActionableMegaphone | undefined;

  if (
    !hasCompletedUsernameOnboarding &&
    !username &&
    globalModals.usernameOnboardingState === UsernameOnboardingState.NeverShown
  ) {
    megaphone = {
      type: MegaphoneType.UsernameOnboarding,
      onLearnMore: toggleUsernameOnboarding,
      onDismiss: () => {
        drop(window.storage.put('hasCompletedUsernameOnboarding', true));
      },
    };
  }

  const centerToast =
    isShowingAnyModal ||
    isShowingStory ||
    isShowingLightbox ||
    isInFullScreenCall;

  const isCompositionAreaVisible =
    selectedNavTab === NavTab.Chats && Boolean(selectedConversationId);

  return (
    <ToastManager
      i18n={i18n}
      OS={OS.getName()}
      toast={toast}
      megaphone={disableMegaphone ? undefined : megaphone}
      onShowDebugLog={handleShowDebugLog}
      onUndoArchive={onUndoArchive}
      openFileInFolder={openFileInFolder}
      hideToast={hideToast}
      showAttachmentNotAvailableModal={showAttachmentNotAvailableModal}
      centerToast={centerToast}
      containerWidthBreakpoint={containerWidthBreakpoint}
      isCompositionAreaVisible={isCompositionAreaVisible}
      isInFullScreenCall={isInFullScreenCall}
    />
  );
});
