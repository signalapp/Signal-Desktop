// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import RealEmojiPicker, {
  type EmojiClickData,
  Categories as EmojiCategories,
  EmojiStyle,
  Theme,
} from '@indutny/emoji-picker-react';

import { useI18n } from '../contexts/I18n';

const EMOJI_PREVIEW_CONFIG = { showPreview: false };

export type EmojiPickerProps = Readonly<{
  onEmojiClick(clickData: EmojiClickData): void;
}>;

function getEmojiUrl() {
  return '../../images/emoji-sheet-64.webp';
}

export default function EmojiPicker({
  onEmojiClick,
}: EmojiPickerProps): JSX.Element {
  const i18n = useI18n();

  const emojiCategories = React.useMemo(() => {
    return [
      EmojiCategories.SMILEYS_PEOPLE,
      EmojiCategories.ANIMALS_NATURE,
      EmojiCategories.FOOD_DRINK,
      EmojiCategories.TRAVEL_PLACES,
      EmojiCategories.ACTIVITIES,
      EmojiCategories.OBJECTS,
      EmojiCategories.SYMBOLS,
      EmojiCategories.FLAGS,
    ].map(category => ({
      category,

      name: i18n(`EmojiPicker--category--${category}`),
    }));
  }, [i18n]);

  return (
    <RealEmojiPicker
      skinTonesDisabled
      theme={Theme.AUTO}
      emojiStyle={EmojiStyle.APPLE}
      getEmojiUrl={getEmojiUrl}
      onEmojiClick={onEmojiClick}
      searchPlaceHolder={i18n('EmojiPicker--search-placeholder')}
      categories={emojiCategories}
      previewConfig={EMOJI_PREVIEW_CONFIG}
    />
  );
}
