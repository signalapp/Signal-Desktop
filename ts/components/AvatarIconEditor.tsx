// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useEffect, useState } from 'react';

import { AvatarColorPicker } from './AvatarColorPicker.js';
import type { AvatarColorType } from '../types/Colors.js';
import type { AvatarDataType } from '../types/Avatar.js';
import { AvatarModalButtons } from './AvatarModalButtons.js';
import { AvatarPreview } from './AvatarPreview.js';
import type { LocalizerType } from '../types/Util.js';
import { avatarDataToBytes } from '../util/avatarDataToBytes.js';

export type PropsType = {
  avatarData: AvatarDataType;
  i18n: LocalizerType;
  onClose: (avatarData?: AvatarDataType) => unknown;
};

export function AvatarIconEditor({
  avatarData: initialAvatarData,
  i18n,
  onClose,
}: PropsType): JSX.Element {
  const [avatarBuffer, setAvatarBuffer] = useState<Uint8Array | undefined>();
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

  return (
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
      <AvatarModalButtons
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
    </>
  );
}
