// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX, SubmitEvent } from 'react';
import { useCallback, useRef, useState } from 'react';
import type { LocalizerType } from '../../../types/Util.std.ts';
import { AvatarEditor } from '../../AvatarEditor.dom.tsx';
import { AvatarPreview } from '../../AvatarPreview.dom.tsx';
import { GroupDescriptionInput } from '../../GroupDescriptionInput.dom.tsx';
import { GroupTitleInput } from '../../GroupTitleInput.dom.tsx';
import { RequestState } from './util.std.ts';
import type {
  AvatarDataType,
  DeleteAvatarFromDiskActionType,
  ReplaceAvatarActionType,
  SaveAvatarToDiskActionType,
} from '../../../types/Avatar.std.ts';
import type { AvatarColorType } from '../../../types/Colors.std.ts';
import { useConfirmDiscard } from '../../../hooks/useConfirmDiscard.dom.tsx';
import { AxoDialog } from '../../../axo/AxoDialog.dom.tsx';

type PropsType = {
  avatarColor?: AvatarColorType;
  avatarUrl?: string;
  conversationId: string;
  groupDescription?: string;
  i18n: LocalizerType;
  initiallyFocusDescription: boolean;
  makeRequest: (
    _: Readonly<{
      avatar?: undefined | Uint8Array<ArrayBuffer>;
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
  const formRef = useRef<HTMLFormElement>(null);
  const focusDescriptionRef = useRef<undefined | boolean>(
    initiallyFocusDescription
  );
  const focusDescription = focusDescriptionRef.current;

  const startingTitleRef = useRef<string>(externalTitle);
  const startingAvatarUrlRef = useRef<undefined | string>(externalAvatarUrl);

  const [editingAvatar, setEditingAvatar] = useState(false);
  const [avatar, setAvatar] = useState<undefined | Uint8Array<ArrayBuffer>>();
  const [rawTitle, setRawTitle] = useState(externalTitle);
  const [rawGroupDescription, setRawGroupDescription] = useState(
    externalGroupDescription
  );
  const [hasAvatarChanged, setHasAvatarChanged] = useState(false);

  const trimmedTitle = rawTitle.trim();
  const trimmedDescription = rawGroupDescription.trim();

  const tryClose = useRef<(() => void) | null>(null);
  const [confirmDiscardModal, confirmDiscardIf] = useConfirmDiscard({
    i18n,
    name: 'EditConversationAttributesModal',
    tryClose,
    // @ts-expect-error ConfirmationDialog migration: Needs title
    title: null,
    // @ts-expect-error ConfirmationDialog migration: Needs description
    description: null,
  });

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

  const onTryClose = useCallback(() => {
    confirmDiscardIf(
      isRequestActive ||
        hasAvatarChanged ||
        hasChangedExternally ||
        hasGroupDescriptionChanged ||
        hasTitleChanged,
      onClose
    );
  }, [
    confirmDiscardIf,
    isRequestActive,
    hasAvatarChanged,
    hasChangedExternally,
    hasGroupDescriptionChanged,
    hasTitleChanged,
    onClose,
  ]);
  tryClose.current = onTryClose;

  function onRequestSubmit() {
    formRef.current?.requestSubmit();
  }

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const request: {
      avatar?: undefined | Uint8Array<ArrayBuffer>;
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
  }

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
        ref={formRef}
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
          showUploadButton
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

  if (confirmDiscardModal) {
    return confirmDiscardModal;
  }

  return (
    <AxoDialog.Root open onOpenChange={onTryClose}>
      <AxoDialog.Content size="md" escape="cancel-is-destructive">
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n('icu:updateGroupAttributes__title')}
          </AxoDialog.Title>
        </AxoDialog.Header>
        <AxoDialog.Body>{content}</AxoDialog.Body>
        {/* AvatarEditor brings its own footer with it so no need to duplicate it. */}
        {!editingAvatar && (
          <AxoDialog.Footer>
            <AxoDialog.Actions>
              <AxoDialog.Action
                variant="secondary"
                onClick={onClose}
                disabled={isRequestActive}
              >
                {i18n('icu:cancel')}
              </AxoDialog.Action>
              <AxoDialog.Action
                variant="primary"
                onClick={onRequestSubmit}
                disabled={!canSubmit}
                pending={isRequestActive}
              >
                {i18n('icu:save')}
              </AxoDialog.Action>
            </AxoDialog.Actions>
          </AxoDialog.Footer>
        )}
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}
