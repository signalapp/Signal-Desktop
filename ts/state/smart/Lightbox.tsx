// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useSelector } from 'react-redux';

import type { GetConversationByIdType } from '../selectors/conversations';
import type { LocalizerType } from '../../types/Util';
import type { MediaItemType } from '../../types/MediaItem';
import type { StateType } from '../reducer';
import { Lightbox } from '../../components/Lightbox';
import { getConversationSelector } from '../selectors/conversations';
import { getIntl } from '../selectors/user';
import { useConversationsActions } from '../ducks/conversations';
import { useGlobalModalActions } from '../ducks/globalModals';
import { useLightboxActions } from '../ducks/lightbox';
import {
  getIsViewOnce,
  getMedia,
  getSelectedIndex,
  shouldShowLightbox,
} from '../selectors/lightbox';

export function SmartLightbox(): JSX.Element | null {
  const i18n = useSelector<StateType, LocalizerType>(getIntl);
  const { saveAttachment } = useConversationsActions();
  const { closeLightbox } = useLightboxActions();
  const { toggleForwardMessageModal } = useGlobalModalActions();

  const conversationSelector = useSelector<StateType, GetConversationByIdType>(
    getConversationSelector
  );

  const isShowingLightbox = useSelector<StateType, boolean>(shouldShowLightbox);
  const isViewOnce = useSelector<StateType, boolean>(getIsViewOnce);
  const media = useSelector<StateType, ReadonlyArray<MediaItemType>>(getMedia);
  const selectedIndex = useSelector<StateType, number>(getSelectedIndex);

  if (!isShowingLightbox) {
    return null;
  }

  return (
    <Lightbox
      closeLightbox={closeLightbox}
      getConversation={conversationSelector}
      i18n={i18n}
      isViewOnce={isViewOnce}
      media={media}
      saveAttachment={saveAttachment}
      selectedIndex={selectedIndex || 0}
      toggleForwardMessageModal={toggleForwardMessageModal}
    />
  );
}
