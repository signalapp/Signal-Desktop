// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import { Modal } from './Modal';
import { ConfirmationDialog } from './ConfirmationDialog';
import {
  ProfileEditor,
  PropsType as ProfileEditorPropsType,
  EditState,
} from './ProfileEditor';
import { ProfileDataType } from '../state/ducks/conversations';

export type PropsDataType = {
  hasError: boolean;
};

type PropsType = {
  myProfileChanged: (
    profileData: ProfileDataType,
    avatarData?: ArrayBuffer
  ) => unknown;
  toggleProfileEditor: () => unknown;
  toggleProfileEditorHasError: () => unknown;
} & PropsDataType &
  ProfileEditorPropsType;

export const ProfileEditorModal = ({
  hasError,
  i18n,
  myProfileChanged,
  onSetSkinTone,
  toggleProfileEditor,
  toggleProfileEditorHasError,
  ...restProps
}: PropsType): JSX.Element => {
  const ModalTitles = {
    None: i18n('ProfileEditorModal--profile'),
    ProfileName: i18n('ProfileEditorModal--name'),
    Bio: i18n('ProfileEditorModal--about'),
  };

  const [modalTitle, setModalTitle] = useState(ModalTitles.None);

  if (hasError) {
    return (
      <ConfirmationDialog
        cancelText={i18n('Confirmation--confirm')}
        i18n={i18n}
        onClose={toggleProfileEditorHasError}
      >
        {i18n('ProfileEditorModal--error')}
      </ConfirmationDialog>
    );
  }

  return (
    <>
      <Modal
        hasXButton
        i18n={i18n}
        onClose={toggleProfileEditor}
        title={modalTitle}
      >
        <ProfileEditor
          {...restProps}
          i18n={i18n}
          onEditStateChanged={editState => {
            if (editState === EditState.None) {
              setModalTitle(ModalTitles.None);
            } else if (editState === EditState.ProfileName) {
              setModalTitle(ModalTitles.ProfileName);
            } else if (editState === EditState.Bio) {
              setModalTitle(ModalTitles.Bio);
            }
          }}
          onProfileChanged={(profileData, avatarData) => {
            myProfileChanged(profileData, avatarData);
          }}
          onSetSkinTone={onSetSkinTone}
        />
      </Modal>
    </>
  );
};
