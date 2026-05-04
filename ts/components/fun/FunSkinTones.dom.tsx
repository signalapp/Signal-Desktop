// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useCallback, useMemo, type JSX } from 'react';
import type { Selection } from 'react-aria-components';
import { ListBox, ListBoxItem } from 'react-aria-components';
import { strictAssert } from '../../util/assert.std.ts';
import { FunStaticEmoji } from './FunEmoji.dom.tsx';
import type { LocalizerType } from '../../types/I18N.std.ts';
import { Emoji } from '../../axo/emoji.std.ts';

export type FunSkinTonesListProps = Readonly<{
  i18n: LocalizerType;
  emoji: Emoji.Parent;
  skinTone: Emoji.SkinTone | null;
  onSelectSkinTone: (skinTone: Emoji.SkinTone) => void;
}>;

export function FunSkinTonesList(props: FunSkinTonesListProps): JSX.Element {
  const { i18n, onSelectSkinTone } = props;

  const handleSelectionChange = useCallback(
    (keys: Selection) => {
      strictAssert(keys !== 'all', 'Expected single selection');
      strictAssert(keys.size === 1, 'Expected single selection');
      const [first] = keys.values();
      onSelectSkinTone(first as Emoji.SkinTone);
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
        skinTone={Emoji.SkinTone.None}
      />
      <FunSkinTonesListItem
        emoji={props.emoji}
        skinTone={Emoji.SkinTone.Type1}
        aria-label={i18n('icu:FunSkinTones__ListItem--Light')}
      />
      <FunSkinTonesListItem
        emoji={props.emoji}
        skinTone={Emoji.SkinTone.Type2}
        aria-label={i18n('icu:FunSkinTones__ListItem--MediumLight')}
      />
      <FunSkinTonesListItem
        emoji={props.emoji}
        skinTone={Emoji.SkinTone.Type3}
        aria-label={i18n('icu:FunSkinTones__ListItem--Medium')}
      />
      <FunSkinTonesListItem
        emoji={props.emoji}
        skinTone={Emoji.SkinTone.Type4}
        aria-label={i18n('icu:FunSkinTones__ListItem--MediumDark')}
      />
      <FunSkinTonesListItem
        emoji={props.emoji}
        skinTone={Emoji.SkinTone.Type5}
        aria-label={i18n('icu:FunSkinTones__ListItem--Dark')}
      />
    </ListBox>
  );
}

type FunSkinTonesListItemProps = Readonly<{
  emoji: Emoji.Parent;
  'aria-label': string;
  skinTone: Emoji.SkinTone;
}>;

function FunSkinTonesListItem(props: FunSkinTonesListItemProps) {
  const variant = useMemo(() => {
    return Emoji.getVariant(props.emoji, props.skinTone);
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
