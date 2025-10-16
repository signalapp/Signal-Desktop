// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { itemStorage } from '../textsecure/Storage.preload.js';
import { onHasStoriesDisabledChange } from '../textsecure/WebAPI.preload.js';

export const getStoriesDisabled = (): boolean =>
  itemStorage.get('hasStoriesDisabled', false);

export const setStoriesDisabled = async (value: boolean): Promise<void> => {
  await itemStorage.put('hasStoriesDisabled', value);
  const account = window.ConversationController.getOurConversationOrThrow();
  account.captureChange('hasStoriesDisabled');
  onHasStoriesDisabledChange(value);
};

export const getStoriesBlocked = (): boolean => getStoriesDisabled();
