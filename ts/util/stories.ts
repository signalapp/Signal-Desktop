// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export const getStoriesDisabled = (): boolean =>
  window.storage.get('hasStoriesDisabled', false);

export const setStoriesDisabled = async (value: boolean): Promise<void> => {
  await window.storage.put('hasStoriesDisabled', value);
  const account = window.ConversationController.getOurConversationOrThrow();
  account.captureChange('hasStoriesDisabled');
  window.textsecure.server?.onHasStoriesDisabledChange(value);
};

export const getStoriesBlocked = (): boolean => getStoriesDisabled();
