// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { AvatarColorType } from '../types/Colors';
import { AvatarColors } from '../types/Colors';
import type { LocalizerType } from '../types/Util';
import { BetterAvatarBubble } from './BetterAvatarBubble';

export type PropsType = {
  i18n: LocalizerType;
  onColorSelected: (color: AvatarColorType) => unknown;
  selectedColor?: AvatarColorType;
};

export const AvatarColorPicker = ({
  i18n,
  onColorSelected,
  selectedColor,
}: PropsType): JSX.Element => {
  return (
    <>
      <div className="AvatarEditor__avatar-selector-title">
        {i18n('AvatarColorPicker--choose')}
      </div>
      <div className="AvatarEditor__avatars">
        {AvatarColors.map(color => (
          <BetterAvatarBubble
            color={color}
            i18n={i18n}
            isSelected={selectedColor === color}
            key={color}
            onSelect={() => {
              onColorSelected(color);
            }}
          />
        ))}
      </div>
    </>
  );
};
