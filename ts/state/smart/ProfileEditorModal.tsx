// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { ProfileEditorModal } from '../../components/ProfileEditorModal';
import { useConversationsActions } from '../ducks/conversations';
import { useGlobalModalActions } from '../ducks/globalModals';
import { useItemsActions } from '../ducks/items';
import { useToastActions } from '../ducks/toast';
import { useUsernameActions } from '../ducks/username';
import { getMe } from '../selectors/conversations';
import { selectRecentEmojis } from '../selectors/emojis';
import {
  getProfileEditorHasError,
  getProfileEditorInitialEditState,
} from '../selectors/globalModals';
import {
  getEmojiSkinTone,
  getHasCompletedUsernameLinkOnboarding,
  getUsernameCorrupted,
  getUsernameLink,
  getUsernameLinkColor,
  getUsernameLinkCorrupted,
} from '../selectors/items';
import { getIntl } from '../selectors/user';
import {
  getUsernameEditState,
  getUsernameLinkState,
} from '../selectors/username';
import type { SmartEditUsernameModalBodyProps } from './EditUsernameModalBody';
import { SmartEditUsernameModalBody } from './EditUsernameModalBody';

function renderEditUsernameModalBody(
  props: SmartEditUsernameModalBodyProps
): JSX.Element {
  return <SmartEditUsernameModalBody {...props} />;
}

export const SmartProfileEditorModal = memo(function SmartProfileEditorModal() {
  const i18n = useSelector(getIntl);
  const {
    aboutEmoji,
    aboutText,
    avatars: userAvatarData = [],
    color,
    familyName,
    firstName,
    id: conversationId,
    profileAvatarUrl,
    username,
  } = useSelector(getMe);
  const hasCompletedUsernameLinkOnboarding = useSelector(
    getHasCompletedUsernameLinkOnboarding
  );
  const hasError = useSelector(getProfileEditorHasError);
  const initialEditState = useSelector(getProfileEditorInitialEditState);
  const recentEmojis = useSelector(selectRecentEmojis);
  const skinTone = useSelector(getEmojiSkinTone);
  const usernameCorrupted = useSelector(getUsernameCorrupted);
  const usernameEditState = useSelector(getUsernameEditState);
  const usernameLink = useSelector(getUsernameLink);
  const usernameLinkColor = useSelector(getUsernameLinkColor);
  const usernameLinkCorrupted = useSelector(getUsernameLinkCorrupted);
  const usernameLinkState = useSelector(getUsernameLinkState);

  const {
    replaceAvatar,
    saveAvatarToDisk,
    saveAttachment,
    deleteAvatarFromDisk,
    myProfileChanged,
  } = useConversationsActions();
  const {
    resetUsernameLink,
    setUsernameLinkColor,
    setUsernameEditState,
    openUsernameReservationModal,
    markCompletedUsernameLinkOnboarding,
    deleteUsername,
  } = useUsernameActions();
  const { toggleProfileEditor, toggleProfileEditorHasError } =
    useGlobalModalActions();
  const { showToast } = useToastActions();
  const { onSetSkinTone } = useItemsActions();

  return (
    <ProfileEditorModal
      aboutEmoji={aboutEmoji}
      aboutText={aboutText}
      color={color}
      conversationId={conversationId}
      deleteAvatarFromDisk={deleteAvatarFromDisk}
      deleteUsername={deleteUsername}
      familyName={familyName}
      firstName={firstName ?? ''}
      hasCompletedUsernameLinkOnboarding={hasCompletedUsernameLinkOnboarding}
      hasError={hasError}
      i18n={i18n}
      initialEditState={initialEditState}
      markCompletedUsernameLinkOnboarding={markCompletedUsernameLinkOnboarding}
      myProfileChanged={myProfileChanged}
      onSetSkinTone={onSetSkinTone}
      openUsernameReservationModal={openUsernameReservationModal}
      profileAvatarUrl={profileAvatarUrl}
      recentEmojis={recentEmojis}
      renderEditUsernameModalBody={renderEditUsernameModalBody}
      replaceAvatar={replaceAvatar}
      resetUsernameLink={resetUsernameLink}
      saveAttachment={saveAttachment}
      saveAvatarToDisk={saveAvatarToDisk}
      setUsernameEditState={setUsernameEditState}
      setUsernameLinkColor={setUsernameLinkColor}
      showToast={showToast}
      skinTone={skinTone}
      toggleProfileEditor={toggleProfileEditor}
      toggleProfileEditorHasError={toggleProfileEditorHasError}
      userAvatarData={userAvatarData}
      username={username}
      usernameCorrupted={usernameCorrupted}
      usernameEditState={usernameEditState}
      usernameLink={usernameLink}
      usernameLinkColor={usernameLinkColor}
      usernameLinkCorrupted={usernameLinkCorrupted}
      usernameLinkState={usernameLinkState}
    />
  );
});
