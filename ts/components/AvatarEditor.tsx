// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useEffect, useState } from 'react';

import type { AvatarColorType } from '../types/Colors';
import type {
  AvatarDataType,
  DeleteAvatarFromDiskActionType,
  ReplaceAvatarActionType,
  SaveAvatarToDiskActionType,
} from '../types/Avatar';
import { AvatarIconEditor } from './AvatarIconEditor';
import { AvatarModalButtons } from './AvatarModalButtons';
import { AvatarPreview } from './AvatarPreview';
import { AvatarTextEditor } from './AvatarTextEditor';
import { AvatarUploadButton } from './AvatarUploadButton';
import { BetterAvatar } from './BetterAvatar';
import type { LocalizerType } from '../types/Util';
import { avatarDataToBytes } from '../util/avatarDataToBytes';
import { createAvatarData } from '../util/createAvatarData';
import { isSameAvatarData } from '../util/isSameAvatarData';
import { missingCaseError } from '../util/missingCaseError';

export type PropsType = {
  avatarColor?: AvatarColorType;
  avatarUrl?: string;
  avatarValue?: Uint8Array;
  conversationId?: string;
  conversationTitle?: string;
  deleteAvatarFromDisk: DeleteAvatarFromDiskActionType;
  i18n: LocalizerType;
  isGroup?: boolean;
  onCancel: () => unknown;
  onSave: (buffer: Uint8Array | undefined) => unknown;
  userAvatarData: ReadonlyArray<AvatarDataType>;
  replaceAvatar: ReplaceAvatarActionType;
  saveAvatarToDisk: SaveAvatarToDiskActionType;
};

enum EditMode {
  Main = 'Main',
  Custom = 'Custom',
  Text = 'Text',
}

export function AvatarEditor({
  avatarColor,
  avatarUrl,
  avatarValue,
  conversationId,
  conversationTitle,
  deleteAvatarFromDisk,
  i18n,
  isGroup,
  onCancel,
  onSave,
  userAvatarData,
  replaceAvatar,
  saveAvatarToDisk,
}: PropsType): JSX.Element {
  const [provisionalSelectedAvatar, setProvisionalSelectedAvatar] = useState<
    AvatarDataType | undefined
  >();
  const [avatarPreview, setAvatarPreview] = useState<Uint8Array | undefined>(
    avatarValue
  );
  const [initialAvatar, setInitialAvatar] = useState<Uint8Array | undefined>(
    avatarValue
  );
  const [localAvatarData, setLocalAvatarData] = useState<Array<AvatarDataType>>(
    userAvatarData.slice()
  );
  const [pendingClear, setPendingClear] = useState(false);

  const [editMode, setEditMode] = useState<EditMode>(EditMode.Main);

  const getSelectedAvatar = useCallback(
    avatarToFind =>
      localAvatarData.find(avatarData =>
        isSameAvatarData(avatarData, avatarToFind)
      ),
    [localAvatarData]
  );

  const selectedAvatar = getSelectedAvatar(provisionalSelectedAvatar);

  // Caching the Uint8Array produced into avatarData as buffer because
  // that function is a little expensive to run and so we don't flicker the UI.
  useEffect(() => {
    let shouldCancel = false;

    async function cacheAvatars() {
      const newAvatarData = await Promise.all(
        userAvatarData.map(async avatarData => {
          if (avatarData.buffer) {
            return avatarData;
          }
          const buffer = await avatarDataToBytes(avatarData);
          return {
            ...avatarData,
            buffer,
          };
        })
      );

      if (!shouldCancel) {
        setLocalAvatarData(newAvatarData);
      }
    }

    void cacheAvatars();

    return () => {
      shouldCancel = true;
    };
  }, [setLocalAvatarData, userAvatarData]);

  // This function optimistcally updates userAvatarData so we don't have to
  // wait for saveAvatarToDisk to finish before displaying something to the
  // user. As a bonus the component fully works in storybook!
  const updateAvatarDataList = useCallback(
    (newAvatarData?: AvatarDataType, staleAvatarData?: AvatarDataType) => {
      const existingAvatarData = staleAvatarData
        ? localAvatarData.filter(avatarData => avatarData !== staleAvatarData)
        : localAvatarData;

      if (newAvatarData) {
        setAvatarPreview(newAvatarData.buffer);
        setLocalAvatarData([newAvatarData, ...existingAvatarData]);
        setProvisionalSelectedAvatar(newAvatarData);
      } else {
        setLocalAvatarData(existingAvatarData);
        if (isSameAvatarData(selectedAvatar, staleAvatarData)) {
          setAvatarPreview(undefined);
          setProvisionalSelectedAvatar(undefined);
        }
      }
    },
    [
      localAvatarData,
      selectedAvatar,
      setAvatarPreview,
      setLocalAvatarData,
      setProvisionalSelectedAvatar,
    ]
  );

  const handleAvatarLoaded = useCallback(avatarBuffer => {
    setAvatarPreview(avatarBuffer);
    setInitialAvatar(avatarBuffer);
  }, []);

  const hasChanges =
    initialAvatar !== avatarPreview || Boolean(pendingClear && avatarUrl);

  let content: JSX.Element | undefined;

  if (editMode === EditMode.Main) {
    content = (
      <>
        <div className="AvatarEditor__preview">
          <AvatarPreview
            avatarColor={avatarColor}
            avatarUrl={pendingClear ? undefined : avatarUrl}
            avatarValue={avatarPreview}
            conversationTitle={conversationTitle}
            i18n={i18n}
            isGroup={isGroup}
            onAvatarLoaded={handleAvatarLoaded}
            onClear={() => {
              setPendingClear(true);
              setAvatarPreview(undefined);
              setProvisionalSelectedAvatar(undefined);
            }}
          />
          <div className="AvatarEditor__top-buttons">
            <AvatarUploadButton
              className="AvatarEditor__button AvatarEditor__button--photo"
              i18n={i18n}
              onChange={newAvatar => {
                const avatarData = createAvatarData({
                  buffer: newAvatar,
                  // This is so that the newly created avatar gets an X
                  imagePath: 'TMP',
                });
                saveAvatarToDisk(avatarData, conversationId);
                updateAvatarDataList(avatarData);
              }}
            />
            <button
              className="AvatarEditor__button AvatarEditor__button--text"
              onClick={() => {
                setProvisionalSelectedAvatar(undefined);
                setEditMode(EditMode.Text);
              }}
              type="button"
            >
              {i18n('icu:text')}
            </button>
          </div>
        </div>
        <hr className="AvatarEditor__divider" />
        <div className="AvatarEditor__avatar-selector-title">
          {i18n('icu:AvatarEditor--choose')}
        </div>
        <div className="AvatarEditor__avatars">
          {localAvatarData.map(avatarData => (
            <BetterAvatar
              avatarData={avatarData}
              key={avatarData.id}
              i18n={i18n}
              isSelected={isSameAvatarData(avatarData, selectedAvatar)}
              onClick={avatarBuffer => {
                if (isSameAvatarData(avatarData, selectedAvatar)) {
                  if (avatarData.text) {
                    setEditMode(EditMode.Text);
                  } else if (avatarData.icon) {
                    setEditMode(EditMode.Custom);
                  }
                } else {
                  setAvatarPreview(avatarBuffer);
                  setProvisionalSelectedAvatar(avatarData);
                }
              }}
              onDelete={() => {
                updateAvatarDataList(undefined, avatarData);
                deleteAvatarFromDisk(avatarData, conversationId);
              }}
            />
          ))}
        </div>
        <AvatarModalButtons
          hasChanges={hasChanges}
          i18n={i18n}
          onCancel={onCancel}
          onSave={() => {
            if (selectedAvatar) {
              replaceAvatar(selectedAvatar, selectedAvatar, conversationId);
            }
            onSave(avatarPreview);
          }}
        />
      </>
    );
  } else if (editMode === EditMode.Text) {
    content = (
      <AvatarTextEditor
        avatarData={selectedAvatar}
        i18n={i18n}
        onCancel={() => {
          setEditMode(EditMode.Main);
          if (selectedAvatar) {
            return;
          }

          // The selected avatar was cleared when we entered text mode so we
          // need to find if one is actually selected if it matches the current
          // preview.
          const actualAvatarSelected = localAvatarData.find(
            avatarData => avatarData.buffer === avatarPreview
          );
          if (actualAvatarSelected) {
            setProvisionalSelectedAvatar(actualAvatarSelected);
          }
        }}
        onDone={(avatarBuffer, avatarData) => {
          const newAvatarData = {
            ...avatarData,
            buffer: avatarBuffer,
          };
          updateAvatarDataList(newAvatarData, selectedAvatar);
          setEditMode(EditMode.Main);
          replaceAvatar(newAvatarData, selectedAvatar, conversationId);
        }}
      />
    );
  } else if (editMode === EditMode.Custom) {
    if (!selectedAvatar) {
      throw new Error('No selected avatar and editMode is custom');
    }

    content = (
      <AvatarIconEditor
        avatarData={selectedAvatar}
        i18n={i18n}
        onClose={avatarData => {
          if (avatarData) {
            updateAvatarDataList(avatarData, selectedAvatar);
            replaceAvatar(avatarData, selectedAvatar, conversationId);
          }
          setEditMode(EditMode.Main);
        }}
      />
    );
  } else {
    throw missingCaseError(editMode);
  }

  return <div className="AvatarEditor">{content}</div>;
}
