// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useCallback, useMemo } from 'react';
import type { Selection } from 'react-aria-components';
import { ListBox, ListBoxItem } from 'react-aria-components';
import type { EmojiParentKey } from './data/emojis.std.js';
import {
  EmojiSkinTone,
  getEmojiVariantByParentKeyAndSkinTone,
} from './data/emojis.std.js';
import { strictAssert } from '../../util/assert.std.js';
import { FunStaticEmoji } from './FunEmoji.dom.js';
import type { LocalizerType } from '../../types/I18N.std.js';

export type FunSkinTonesListProps = Readonly<{
  i18n: LocalizerType;
  emoji: EmojiParentKey;
  skinTone: EmojiSkinTone | null;
  onSelectSkinTone: (skinTone: EmojiSkinTone) => void;
}>;

export function FunSkinTonesList(props: FunSkinTonesListProps): JSX.Element {
  const { i18n, onSelectSkinTone } = props;

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
      aria-label={i18n('icu:FunSkinTones__List')}
      className="FunSkinTones__ListBox"
      orientation="horizontal"
      selectedKeys={props.skinTone != null ? [props.skinTone] : undefined}
      selectionMode="single"
      disallowEmptySelection={false}
      onSelectionChange={handleSelectionChange}
    >
      <FunSkinTonesListItem
        emoji={props.emoji}
        aria-label={i18n('icu:FunSkinTones__ListItem--None')}
        skinTone={EmojiSkinTone.None}
      />
      <FunSkinTonesListItem
        emoji={props.emoji}
        skinTone={EmojiSkinTone.Type1}
        aria-label={i18n('icu:FunSkinTones__ListItem--Light')}
      />
      <FunSkinTonesListItem
        emoji={props.emoji}
        skinTone={EmojiSkinTone.Type2}
        aria-label={i18n('icu:FunSkinTones__ListItem--MediumLight')}
      />
      <FunSkinTonesListItem
        emoji={props.emoji}
        skinTone={EmojiSkinTone.Type3}
        aria-label={i18n('icu:FunSkinTones__ListItem--Medium')}
      />
      <FunSkinTonesListItem
        emoji={props.emoji}
        skinTone={EmojiSkinTone.Type4}
        aria-label={i18n('icu:FunSkinTones__ListItem--MediumDark')}
      />
      <FunSkinTonesListItem
        emoji={props.emoji}
        skinTone={EmojiSkinTone.Type5}
        aria-label={i18n('icu:FunSkinTones__ListItem--Dark')}
      />
    </ListBox>
  );
}

type FunSkinTonesListItemProps = Readonly<{
  emoji: EmojiParentKey;
  'aria-label': string;
  skinTone: EmojiSkinTone;
}>;

function FunSkinTonesListItem(props: FunSkinTonesListItemProps) {
  const variant = useMemo(() => {
    return getEmojiVariantByParentKeyAndSkinTone(props.emoji, props.skinTone);
  }, [props.emoji, props.skinTone]);

  return (
    <ListBoxItem
      id={props.skinTone}
      className="FunSkinTones__ListBoxItem"
      aria-label={props['aria-label']}
    >
      <div className="FunSkinTones__ListBoxItemButton">
        <FunStaticEmoji role="presentation" size={32} emoji={variant} />
      </div>
    </ListBoxItem>
  );
}
