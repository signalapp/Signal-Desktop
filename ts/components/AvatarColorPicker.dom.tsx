// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { AvatarColorType } from '../types/Colors.std.ts';
import { AvatarColors } from '../types/Colors.std.ts';
import type { LocalizerType } from '../types/Util.std.ts';
import { BetterAvatarBubble } from './BetterAvatarBubble.dom.tsx';

export type PropsType = {
  i18n: LocalizerType;
  onColorSelected: (color: AvatarColorType) => unknown;
  selectedColor?: AvatarColorType;
};

export function AvatarColorPicker({
  i18n,
  onColorSelected,
  selectedColor,
}: PropsType): React.JSX.Element {
  return (
    <>
      <div className="AvatarEditor__avatar-selector-title">
        {i18n('icu:AvatarColorPicker--choose')}
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
}
