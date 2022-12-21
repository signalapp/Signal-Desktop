// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useSelector } from 'react-redux';
import type { CompositionTextAreaProps } from '../../components/CompositionTextArea';
import { CompositionTextArea } from '../../components/CompositionTextArea';
import type { LocalizerType } from '../../types/I18N';
import type { StateType } from '../reducer';
import { getIntl } from '../selectors/user';
import { useActions as useEmojiActions } from '../ducks/emojis';
import { useActions as useItemsActions } from '../ducks/items';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { useComposerActions } from '../ducks/composer';

export type SmartCompositionTextAreaProps = Pick<
  CompositionTextAreaProps,
  | 'draftText'
  | 'placeholder'
  | 'onChange'
  | 'onScroll'
  | 'onSubmit'
  | 'theme'
  | 'maxLength'
  | 'whenToShowRemainingCount'
  | 'scrollerRef'
>;

export function SmartCompositionTextArea(
  props: SmartCompositionTextAreaProps
): JSX.Element {
  const i18n = useSelector<StateType, LocalizerType>(getIntl);

  const { onUseEmoji: onPickEmoji } = useEmojiActions();
  const { onSetSkinTone } = useItemsActions();
  const { onTextTooLong } = useComposerActions();

  const getPreferredBadge = useSelector(getPreferredBadgeSelector);

  return (
    <CompositionTextArea
      {...props}
      i18n={i18n}
      onPickEmoji={onPickEmoji}
      onSetSkinTone={onSetSkinTone}
      getPreferredBadge={getPreferredBadge}
      onTextTooLong={onTextTooLong}
    />
  );
}
