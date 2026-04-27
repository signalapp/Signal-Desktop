// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { getHeapSnapshot } from 'node:v8';

import type { AnyActionableMegaphone } from '../../types/Megaphone.std.ts';
import { MegaphoneType } from '../../types/Megaphone.std.ts';
import { UsernameOnboardingState } from '../../types/globalModals.std.ts';
import OS from '../../util/os/osMain.node.ts';
import { drop } from '../../util/drop.std.ts';
import { getIntl } from '../selectors/user.std.ts';
import {
  getGlobalModalsState,
  isShowingAnyModal as getIsShowingAnyModal,
} from '../selectors/globalModals.std.ts';
import { hasSelectedStoryData } from '../selectors/stories.preload.ts';
import { shouldShowLightbox } from '../selectors/lightbox.std.ts';
import { isInFullScreenCall as getIsInFullScreenCall } from '../selectors/calling.std.ts';
import {
  getSelectedConversationId,
  getSelectedNavTab,
} from '../selectors/nav.std.ts';
import { getMe } from '../selectors/conversations.dom.ts';
import { useConversationsActions } from '../ducks/conversations.preload.ts';
import { useCallingActions } from '../ducks/calling.preload.ts';
import { useToastActions } from '../ducks/toast.preload.ts';
import { useGlobalModalActions } from '../ducks/globalModals.preload.ts';
import { useNavActions } from '../ducks/nav.std.ts';
import { NavTab } from '../../types/Nav.std.ts';
import { getHasCompletedUsernameOnboarding } from '../selectors/items.dom.ts';
import { ToastManager } from '../../components/ToastManager.dom.tsx';
import type { WidthBreakpoint } from '../../components/_util.std.ts';
import { getToast } from '../selectors/toast.std.ts';
import { useDonationsActions } from '../ducks/donations.preload.ts';
import { itemStorage } from '../../textsecure/Storage.preload.ts';
import { getVisibleMegaphonesForDisplay } from '../selectors/megaphones.preload.ts';
import { useMegaphonesActions } from '../ducks/megaphones.preload.ts';
import { shouldNeverBeCalled } from '../../util/shouldNeverBeCalled.std.ts';
import { saveAttachmentToDisk } from '../../windows/main/attachments.preload.ts';
import * as Bytes from '../../Bytes.std.ts';

export type SmartPropsType = Readonly<{
  disableMegaphone?: boolean;
  containerWidthBreakpoint: WidthBreakpoint;
  expandNarrowLeftPane: () => void;
}>;

function handleShowDebugLog() {
  window.IPC.showDebugLog();
}

async function saveHeapSnapshot() {
  const stream = getHeapSnapshot();

  const chunks = new Array<Uint8Array<ArrayBuffer>>();
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  const data = Bytes.concatenate(chunks);

  await saveAttachmentToDisk({
    data,
    name: `signal-desktop-${Date.now()}.heapsnapshot`,
  });
}

export function renderToastManagerWithoutMegaphone(props: {
  containerWidthBreakpoint: WidthBreakpoint;
}): React.JSX.Element {
  return (
    <SmartToastManager
      disableMegaphone
      expandNarrowLeftPane={shouldNeverBeCalled}
      {...props}
    />
  );
}

export const SmartToastManager = memo(function SmartToastManager({
  disableMegaphone = false,
  containerWidthBreakpoint,
  expandNarrowLeftPane,
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
  const megaphones = useSelector(getVisibleMegaphonesForDisplay);

  const { changeLocation } = useNavActions();
  const { setDidResume } = useDonationsActions();

  const { onUndoArchive } = useConversationsActions();
  const { retryCallQualitySurvey } = useCallingActions();
  const { openFileInFolder, hideToast } = useToastActions();
  const { toggleUsernameOnboarding } = useGlobalModalActions();
  const { interactWithMegaphone } = useMegaphonesActions();

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
        drop(itemStorage.put('hasCompletedUsernameOnboarding', true));
      },
    };
  } else if (megaphones.length > 0) {
    megaphone = {
      // oxlint-disable-next-line typescript/no-non-null-assertion
      ...megaphones[0]!,
      type: MegaphoneType.Remote,
      onInteractWithMegaphone: interactWithMegaphone,
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
      changeLocation={changeLocation}
      i18n={i18n}
      OS={OS.getName()}
      toast={toast}
      megaphone={disableMegaphone ? undefined : megaphone}
      onShowDebugLog={handleShowDebugLog}
      onUndoArchive={onUndoArchive}
      retryCallQualitySurvey={retryCallQualitySurvey}
      openFileInFolder={openFileInFolder}
      saveHeapSnapshot={saveHeapSnapshot}
      hideToast={hideToast}
      setDidResumeDonation={setDidResume}
      centerToast={centerToast}
      containerWidthBreakpoint={containerWidthBreakpoint}
      expandNarrowLeftPane={expandNarrowLeftPane}
      isCompositionAreaVisible={isCompositionAreaVisible}
      isInFullScreenCall={isInFullScreenCall}
    />
  );
});
