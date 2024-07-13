// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FormEventHandler } from 'react';
import React, { useRef, useState } from 'react';

import type { LocalizerType } from '../../../types/Util';
import { Modal } from '../../Modal';
import { AvatarEditor } from '../../AvatarEditor';
import { AvatarPreview } from '../../AvatarPreview';
import { Button, ButtonVariant } from '../../Button';
import { Spinner } from '../../Spinner';
import { GroupDescriptionInput } from '../../GroupDescriptionInput';
import { GroupTitleInput } from '../../GroupTitleInput';
import { RequestState } from './util';
import type {
  AvatarDataType,
  DeleteAvatarFromDiskActionType,
  ReplaceAvatarActionType,
  SaveAvatarToDiskActionType,
} from '../../../types/Avatar';
import type { AvatarColorType } from '../../../types/Colors';

type PropsType = {
  avatarColor?: AvatarColorType;
  avatarUrl?: string;
  conversationId: string;
  groupDescription?: string;
  i18n: LocalizerType;
  initiallyFocusDescription: boolean;
  makeRequest: (
    _: Readonly<{
      avatar?: undefined | Uint8Array;
      description?: string;
      title?: undefined | string;
    }>
  ) => void;
  onClose: () => void;
  requestState: RequestState;
  title: string;
  deleteAvatarFromDisk: DeleteAvatarFromDiskActionType;
  replaceAvatar: ReplaceAvatarActionType;
  saveAvatarToDisk: SaveAvatarToDiskActionType;
  userAvatarData: ReadonlyArray<AvatarDataType>;
};

export function EditConversationAttributesModal({
  avatarColor,
  avatarUrl: externalAvatarUrl,
  conversationId,
  groupDescription: externalGroupDescription = '',
  i18n,
  initiallyFocusDescription,
  makeRequest,
  onClose,
  requestState,
  title: externalTitle,
  deleteAvatarFromDisk,
  replaceAvatar,
  saveAvatarToDisk,
  userAvatarData,
}: PropsType): JSX.Element {
  const focusDescriptionRef = useRef<undefined | boolean>(
    initiallyFocusDescription
  );
  const focusDescription = focusDescriptionRef.current;

  const startingTitleRef = useRef<string>(externalTitle);
  const startingAvatarUrlRef = useRef<undefined | string>(externalAvatarUrl);

  const [editingAvatar, setEditingAvatar] = useState(false);
  const [avatar, setAvatar] = useState<undefined | Uint8Array>();
  const [rawTitle, setRawTitle] = useState(externalTitle);
  const [rawGroupDescription, setRawGroupDescription] = useState(
    externalGroupDescription
  );
  const [hasAvatarChanged, setHasAvatarChanged] = useState(false);

  const trimmedTitle = rawTitle.trim();
  const trimmedDescription = rawGroupDescription.trim();

  const focusRef = (el: null | HTMLElement) => {
    if (el) {
      el.focus();
      focusDescriptionRef.current = undefined;
    }
  };

  const hasChangedExternally =
    startingAvatarUrlRef.current !== externalAvatarUrl ||
    startingTitleRef.current !== externalTitle;
  const hasTitleChanged = trimmedTitle !== externalTitle.trim();
  const hasGroupDescriptionChanged =
    externalGroupDescription.trim() !== trimmedDescription;

  const isRequestActive = requestState === RequestState.Active;

  const canSubmit =
    !isRequestActive &&
    (hasChangedExternally ||
      hasTitleChanged ||
      hasAvatarChanged ||
      hasGroupDescriptionChanged) &&
    trimmedTitle.length > 0;

  const onSubmit: FormEventHandler<HTMLFormElement> = event => {
    event.preventDefault();

    const request: {
      avatar?: undefined | Uint8Array;
      description?: string;
      title?: string;
    } = {};
    if (hasAvatarChanged) {
      request.avatar = avatar;
    }
    if (hasTitleChanged) {
      request.title = trimmedTitle;
    }
    if (hasGroupDescriptionChanged) {
      request.description = trimmedDescription;
    }
    makeRequest(request);
  };

  const avatarUrlForPreview = hasAvatarChanged ? undefined : externalAvatarUrl;

  let content: JSX.Element;
  if (editingAvatar) {
    content = (
      <AvatarEditor
        avatarColor={avatarColor}
        avatarUrl={avatarUrlForPreview}
        avatarValue={avatar}
        conversationId={conversationId}
        deleteAvatarFromDisk={deleteAvatarFromDisk}
        i18n={i18n}
        isGroup
        onCancel={() => {
          setHasAvatarChanged(false);
          setEditingAvatar(false);
        }}
        onSave={newAvatar => {
          setAvatar(newAvatar);
          setHasAvatarChanged(true);
          setEditingAvatar(false);
        }}
        userAvatarData={userAvatarData}
        replaceAvatar={replaceAvatar}
        saveAvatarToDisk={saveAvatarToDisk}
      />
    );
  } else {
    content = (
      <form
        id="edit-conversation-form"
        onSubmit={onSubmit}
        className="module-EditConversationAttributesModal"
      >
        <AvatarPreview
          avatarColor={avatarColor}
          avatarUrl={avatarUrlForPreview}
          avatarValue={avatar}
          i18n={i18n}
          isEditable
          isGroup
          onClick={() => {
            setEditingAvatar(true);
          }}
          style={{
            height: 96,
            width: 96,
          }}
        />

        <GroupTitleInput
          disabled={isRequestActive}
          i18n={i18n}
          onChangeValue={setRawTitle}
          ref={focusDescription === false ? focusRef : undefined}
          value={rawTitle}
        />

        <GroupDescriptionInput
          disabled={isRequestActive}
          i18n={i18n}
          onChangeValue={setRawGroupDescription}
          ref={focusDescription === true ? focusRef : undefined}
          value={rawGroupDescription}
        />

        <div className="module-EditConversationAttributesModal__description-warning">
          {i18n('icu:EditConversationAttributesModal__description-warning')}
        </div>

        {requestState === RequestState.InactiveWithError && (
          <div className="module-EditConversationAttributesModal__error-message">
            {i18n('icu:updateGroupAttributes__error-message')}
          </div>
        )}
      </form>
    );
  }

  // AvatarEditor brings its own footer with it so no need to duplicate it.
  const modalFooter = editingAvatar ? undefined : (
    <>
      <Button
        disabled={isRequestActive}
        onClick={onClose}
        variant={ButtonVariant.Secondary}
      >
        {i18n('icu:cancel')}
      </Button>

      <Button
        type="submit"
        form="edit-conversation-form"
        variant={ButtonVariant.Primary}
        disabled={!canSubmit}
      >
        {isRequestActive ? (
          <Spinner size="20px" svgSize="small" direction="on-avatar" />
        ) : (
          i18n('icu:save')
        )}
      </Button>
    </>
  );

  return (
    <Modal
      modalName="EditConversationAttributesModal"
      hasXButton
      i18n={i18n}
      onClose={onClose}
      title={i18n('icu:updateGroupAttributes__title')}
      modalFooter={modalFooter}
    >
      {content}
    </Modal>
  );
}
