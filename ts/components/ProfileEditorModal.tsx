// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import { Modal } from './Modal';
import { ConfirmationDialog } from './ConfirmationDialog';
import type { PropsType as ProfileEditorPropsType } from './ProfileEditor';
import { ProfileEditor, EditState } from './ProfileEditor';
import type { ProfileDataType } from '../state/ducks/conversations';
import type { AvatarUpdateType } from '../types/Avatar';

export type PropsDataType = {
  hasError: boolean;
};

type PropsType = {
  myProfileChanged: (
    profileData: ProfileDataType,
    avatar: AvatarUpdateType
  ) => unknown;
  toggleProfileEditor: () => unknown;
  toggleProfileEditorHasError: () => unknown;
} & PropsDataType &
  Omit<ProfileEditorPropsType, 'onEditStateChanged' | 'onProfileChanged'>;

export const ProfileEditorModal = ({
  hasError,
  i18n,
  myProfileChanged,
  onSetSkinTone,
  toggleProfileEditor,
  toggleProfileEditorHasError,
  ...restProps
}: PropsType): JSX.Element => {
  const MODAL_TITLES_BY_EDIT_STATE: Record<EditState, string> = {
    [EditState.BetterAvatar]: i18n('ProfileEditorModal--avatar'),
    [EditState.Bio]: i18n('ProfileEditorModal--about'),
    [EditState.None]: i18n('ProfileEditorModal--profile'),
    [EditState.ProfileName]: i18n('ProfileEditorModal--name'),
    [EditState.Username]: i18n('ProfileEditorModal--username'),
  };

  const [modalTitle, setModalTitle] = useState(
    MODAL_TITLES_BY_EDIT_STATE[EditState.None]
  );

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
        hasStickyButtons
        hasXButton
        i18n={i18n}
        onClose={toggleProfileEditor}
        title={modalTitle}
      >
        <ProfileEditor
          {...restProps}
          i18n={i18n}
          onEditStateChanged={editState => {
            setModalTitle(MODAL_TITLES_BY_EDIT_STATE[editState]);
          }}
          onProfileChanged={myProfileChanged}
          onSetSkinTone={onSetSkinTone}
        />
      </Modal>
    </>
  );
};
