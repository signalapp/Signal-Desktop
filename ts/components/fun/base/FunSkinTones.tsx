// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useCallback, useMemo } from 'react';
import type { Selection } from 'react-aria-components';
import { ListBox, ListBoxItem } from 'react-aria-components';
import type { EmojiParentKey } from '../data/emojis';
import {
  EmojiSkinTone,
  getEmojiVariantByParentKeyAndSkinTone,
} from '../data/emojis';
import { strictAssert } from '../../../util/assert';
import { FunEmoji } from '../FunEmoji';

export type SkinTonesListBoxProps = Readonly<{
  emoji: EmojiParentKey;
  skinTone: EmojiSkinTone;
  onSelectSkinTone: (skinTone: EmojiSkinTone) => void;
}>;

export function SkinTonesListBox(props: SkinTonesListBoxProps): JSX.Element {
  const { onSelectSkinTone } = props;

  const handleSelectionChange = useCallback(
    (keys: Selection) => {
      strictAssert(keys !== 'all', 'Expected single selection');
      strictAssert(keys.size === 1, 'Expected single selection');
      const [first] = keys.values();
      onSelectSkinTone(first as EmojiSkinTone);
    },
    [onSelectSkinTone]
  );

  return (
    <ListBox
      className="FunSkinTones__ListBox"
      orientation="horizontal"
      selectedKeys={[props.skinTone]}
      selectionMode="single"
      onSelectionChange={handleSelectionChange}
    >
      <SkinTonesListBoxItem emoji={props.emoji} skinTone={EmojiSkinTone.None} />
      <SkinTonesListBoxItem
        emoji={props.emoji}
        skinTone={EmojiSkinTone.Type1}
      />
      <SkinTonesListBoxItem
        emoji={props.emoji}
        skinTone={EmojiSkinTone.Type2}
      />
      <SkinTonesListBoxItem
        emoji={props.emoji}
        skinTone={EmojiSkinTone.Type3}
      />
      <SkinTonesListBoxItem
        emoji={props.emoji}
        skinTone={EmojiSkinTone.Type4}
      />
      <SkinTonesListBoxItem
        emoji={props.emoji}
        skinTone={EmojiSkinTone.Type5}
      />
    </ListBox>
  );
}

type SkinTonesListBoxItemProps = Readonly<{
  emoji: EmojiParentKey;
  skinTone: EmojiSkinTone;
}>;

function SkinTonesListBoxItem(props: SkinTonesListBoxItemProps) {
  const variant = useMemo(() => {
    return getEmojiVariantByParentKeyAndSkinTone(props.emoji, props.skinTone);
  }, [props.emoji, props.skinTone]);

  return (
    <ListBoxItem id={props.skinTone} className="FunSkinTones__ListBoxItem">
      <FunEmoji role="presentation" aria-label="" size={32} emoji={variant} />
    </ListBoxItem>
  );
}
