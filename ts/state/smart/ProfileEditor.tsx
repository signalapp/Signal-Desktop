// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';

import type { MutableRefObject } from 'react';

import { ProfileEditor } from '../../components/ProfileEditor';
import { useConversationsActions } from '../ducks/conversations';
import { useItemsActions } from '../ducks/items';
import { useToastActions } from '../ducks/toast';
import { useUsernameActions } from '../ducks/username';
import { getMe, getProfileUpdateError } from '../selectors/conversations';
import { selectRecentEmojis } from '../selectors/emojis';
import {
  getEmojiSkinToneDefault,
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
import { SmartUsernameEditor } from './UsernameEditor';
import { getSelectedLocation } from '../selectors/nav';
import { useNavActions } from '../ducks/nav';
import { NavTab, SettingsPage } from '../../types/Nav';

import type { ProfileEditorPage } from '../../types/Nav';
import type { SmartUsernameEditorProps } from './UsernameEditor';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';

function renderUsernameEditor(props: SmartUsernameEditorProps): JSX.Element {
  return <SmartUsernameEditor {...props} />;
}

export const SmartProfileEditor = memo(function SmartProfileEditor(props: {
  contentsRef: MutableRefObject<HTMLDivElement | null>;
}) {
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
  const selectedLocation = useSelector(getSelectedLocation);
  const hasCompletedUsernameLinkOnboarding = useSelector(
    getHasCompletedUsernameLinkOnboarding
  );
  const hasError = useSelector(getProfileUpdateError);
  const recentEmojis = useSelector(selectRecentEmojis);
  const emojiSkinToneDefault = useSelector(getEmojiSkinToneDefault);
  const usernameCorrupted = useSelector(getUsernameCorrupted);
  const usernameEditState = useSelector(getUsernameEditState);
  const usernameLink = useSelector(getUsernameLink);
  const usernameLinkColor = useSelector(getUsernameLinkColor);
  const usernameLinkCorrupted = useSelector(getUsernameLinkCorrupted);
  const usernameLinkState = useSelector(getUsernameLinkState);

  const {
    deleteAvatarFromDisk,
    myProfileChanged,
    replaceAvatar,
    saveAttachment,
    saveAvatarToDisk,
    setProfileUpdateError,
  } = useConversationsActions();
  const {
    resetUsernameLink,
    setUsernameLinkColor,
    setUsernameEditState,
    openUsernameReservationModal,
    markCompletedUsernameLinkOnboarding,
    deleteUsername,
  } = useUsernameActions();
  const { showToast } = useToastActions();
  const { setEmojiSkinToneDefault } = useItemsActions();
  const { changeLocation } = useNavActions();

  let errorDialog: JSX.Element | undefined;
  if (hasError) {
    errorDialog = (
      <ConfirmationDialog
        dialogName="ProfileEditorModal.error"
        cancelText={i18n('icu:Confirmation--confirm')}
        i18n={i18n}
        onClose={() => setProfileUpdateError(false)}
      >
        {i18n('icu:ProfileEditorModal--error')}
      </ConfirmationDialog>
    );
  }

  if (
    selectedLocation.tab !== NavTab.Settings ||
    selectedLocation.details.page !== SettingsPage.Profile
  ) {
    return null;
  }

  const editState = selectedLocation.details.state;
  const setEditState = (newState: ProfileEditorPage) => {
    changeLocation({
      tab: NavTab.Settings,
      details: {
        page: SettingsPage.Profile,
        state: newState,
      },
    });
  };

  return (
    <>
      {errorDialog}
      <ProfileEditor
        aboutEmoji={aboutEmoji}
        aboutText={aboutText}
        color={color}
        contentsRef={props.contentsRef}
        conversationId={conversationId}
        deleteAvatarFromDisk={deleteAvatarFromDisk}
        deleteUsername={deleteUsername}
        familyName={familyName}
        firstName={firstName ?? ''}
        hasCompletedUsernameLinkOnboarding={hasCompletedUsernameLinkOnboarding}
        i18n={i18n}
        editState={editState}
        markCompletedUsernameLinkOnboarding={
          markCompletedUsernameLinkOnboarding
        }
        onProfileChanged={myProfileChanged}
        onEmojiSkinToneDefaultChange={setEmojiSkinToneDefault}
        openUsernameReservationModal={openUsernameReservationModal}
        profileAvatarUrl={profileAvatarUrl}
        recentEmojis={recentEmojis}
        renderUsernameEditor={renderUsernameEditor}
        replaceAvatar={replaceAvatar}
        resetUsernameLink={resetUsernameLink}
        saveAttachment={saveAttachment}
        saveAvatarToDisk={saveAvatarToDisk}
        setEditState={setEditState}
        setUsernameEditState={setUsernameEditState}
        setUsernameLinkColor={setUsernameLinkColor}
        showToast={showToast}
        emojiSkinToneDefault={emojiSkinToneDefault}
        userAvatarData={userAvatarData}
        username={username}
        usernameCorrupted={usernameCorrupted}
        usernameEditState={usernameEditState}
        usernameLink={usernameLink}
        usernameLinkColor={usernameLinkColor}
        usernameLinkCorrupted={usernameLinkCorrupted}
        usernameLinkState={usernameLinkState}
      />
    </>
  );
});
