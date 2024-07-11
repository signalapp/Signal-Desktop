// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import { Modal } from './Modal';
import { ConfirmationDialog } from './ConfirmationDialog';
import type { PropsType as ProfileEditorPropsType } from './ProfileEditor';
import { ProfileEditor, EditState } from './ProfileEditor';
import type { ProfileDataType } from '../state/ducks/conversations';
import type { AvatarUpdateOptionsType } from '../types/Avatar';

export type PropsDataType = {
  hasError: boolean;
} & Pick<ProfileEditorPropsType, 'renderEditUsernameModalBody'>;

type PropsType = {
  myProfileChanged: (
    profileData: ProfileDataType,
    avatarUpdateOptions: AvatarUpdateOptionsType
  ) => unknown;
  toggleProfileEditor: () => unknown;
  toggleProfileEditorHasError: () => unknown;
} & PropsDataType &
  Omit<ProfileEditorPropsType, 'onEditStateChanged' | 'onProfileChanged'>;

export function ProfileEditorModal({
  aboutEmoji,
  aboutText,
  color,
  conversationId,
  deleteAvatarFromDisk,
  deleteUsername,
  familyName,
  firstName,
  hasCompletedUsernameLinkOnboarding,
  hasError,
  i18n,
  initialEditState,
  markCompletedUsernameLinkOnboarding,
  myProfileChanged,
  onSetSkinTone,
  openUsernameReservationModal,
  profileAvatarUrl,
  recentEmojis,
  renderEditUsernameModalBody,
  replaceAvatar,
  resetUsernameLink,
  saveAttachment,
  saveAvatarToDisk,
  setUsernameEditState,
  setUsernameLinkColor,
  showToast,
  skinTone,
  toggleProfileEditor,
  toggleProfileEditorHasError,
  userAvatarData,
  username,
  usernameCorrupted,
  usernameEditState,
  usernameLink,
  usernameLinkColor,
  usernameLinkCorrupted,
  usernameLinkState,
}: PropsType): JSX.Element {
  const MODAL_TITLES_BY_EDIT_STATE: Record<EditState, string | undefined> = {
    [EditState.BetterAvatar]: i18n('icu:ProfileEditorModal--avatar'),
    [EditState.Bio]: i18n('icu:ProfileEditorModal--about'),
    [EditState.None]: i18n('icu:ProfileEditorModal--profile'),
    [EditState.ProfileName]: i18n('icu:ProfileEditorModal--name'),
    [EditState.Username]: i18n('icu:ProfileEditorModal--username'),
    [EditState.UsernameLink]: undefined,
  };

  const [modalTitle, setModalTitle] = useState(
    MODAL_TITLES_BY_EDIT_STATE[EditState.None]
  );

  if (hasError) {
    return (
      <ConfirmationDialog
        dialogName="ProfileEditorModal.error"
        cancelText={i18n('icu:Confirmation--confirm')}
        i18n={i18n}
        onClose={toggleProfileEditorHasError}
      >
        {i18n('icu:ProfileEditorModal--error')}
      </ConfirmationDialog>
    );
  }

  return (
    <Modal
      modalName="ProfileEditorModal"
      hasXButton
      i18n={i18n}
      onClose={toggleProfileEditor}
      title={modalTitle}
    >
      <ProfileEditor
        aboutEmoji={aboutEmoji}
        aboutText={aboutText}
        color={color}
        conversationId={conversationId}
        deleteAvatarFromDisk={deleteAvatarFromDisk}
        deleteUsername={deleteUsername}
        familyName={familyName}
        firstName={firstName}
        hasCompletedUsernameLinkOnboarding={hasCompletedUsernameLinkOnboarding}
        i18n={i18n}
        initialEditState={initialEditState}
        markCompletedUsernameLinkOnboarding={
          markCompletedUsernameLinkOnboarding
        }
        onEditStateChanged={editState => {
          setModalTitle(MODAL_TITLES_BY_EDIT_STATE[editState]);
        }}
        onProfileChanged={myProfileChanged}
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
        userAvatarData={userAvatarData}
        username={username}
        usernameCorrupted={usernameCorrupted}
        usernameEditState={usernameEditState}
        usernameLink={usernameLink}
        usernameLinkColor={usernameLinkColor}
        usernameLinkCorrupted={usernameLinkCorrupted}
        usernameLinkState={usernameLinkState}
      />
    </Modal>
  );
}
