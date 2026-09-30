// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useState, type JSX } from 'react';

import { AvatarColorPicker } from './AvatarColorPicker.dom.tsx';
import type { AvatarColorType } from '../types/Colors.std.ts';
import type { AvatarDataType } from '../types/Avatar.std.ts';
import { AvatarModalButtons } from './AvatarModalButtons.dom.tsx';
import { AvatarPreview } from './AvatarPreview.dom.tsx';
import type { LocalizerType } from '../types/Util.std.ts';
import { avatarDataToBytes } from '../util/avatarDataToBytes.dom.ts';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';

export type PropsType = {
  avatarData: AvatarDataType;
  i18n: LocalizerType;
  isInsideDialog: boolean;
  onClose: (avatarData?: AvatarDataType) => unknown;
};

export function AvatarIconEditor({
  avatarData: initialAvatarData,
  i18n,
  isInsideDialog,
  onClose,
}: PropsType): JSX.Element {
  const [avatarBuffer, setAvatarBuffer] = useState<
    Uint8Array<ArrayBuffer> | undefined
  >();
  const [avatarData, setAvatarData] =
    useState<AvatarDataType>(initialAvatarData);

  const onColorSelected = useCallback(
    (color: AvatarColorType) => {
      setAvatarData({
        ...avatarData,
        color,
      });
    },
    [avatarData]
  );

  useEffect(() => {
    let shouldCancel = false;

    async function loadAvatar() {
      const buffer = await avatarDataToBytes(avatarData);
      if (!shouldCancel) {
        setAvatarBuffer(buffer);
      }
    }
    void loadAvatar();

    return () => {
      shouldCancel = true;
    };
  }, [avatarData, setAvatarBuffer]);

  const hasChanges = avatarData !== initialAvatarData;

  const body = (
    <>
      <AvatarPreview
        avatarColor={avatarData.color}
        avatarValue={avatarBuffer}
        conversationTitle={avatarData.text}
        i18n={i18n}
      />
      <hr className="AvatarEditor__divider" />
      <AvatarColorPicker
        i18n={i18n}
        onColorSelected={onColorSelected}
        selectedColor={avatarData.color}
      />
    </>
  );

  const footer = (
    <AvatarModalButtons
      isInsideDialog={isInsideDialog}
      hasChanges={hasChanges}
      i18n={i18n}
      onCancel={onClose}
      onSave={() =>
        onClose({
          ...avatarData,
          buffer: avatarBuffer,
        })
      }
    />
  );

  if (isInsideDialog) {
    return (
      <>
        <AxoDialog.Body forceMaxHeight>{body}</AxoDialog.Body>
        <AxoDialog.Footer>{footer}</AxoDialog.Footer>
      </>
    );
  }

  return (
    <>
      {body}
      {footer}
    </>
  );
}
