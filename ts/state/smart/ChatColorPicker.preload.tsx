// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { ChatColorPicker } from '../../components/ChatColorPicker.dom.tsx';
import {
  getConversationSelector,
  getConversationsWithCustomColorSelector,
} from '../selectors/conversations.dom.ts';
import { getIntl } from '../selectors/user.std.ts';
import { getCustomChatColors } from '../selectors/chatColors.std.ts';
import { getDefaultBubbleColor } from '../selectors/account.std.ts';
import {
  useConversationsActions,
  type ConversationType,
} from '../ducks/conversations.preload.ts';
import { useChatColorsActions } from '../ducks/chatColors.preload.ts';
import { useAccountActions } from '../ducks/account.preload.ts';
import type { ChatStyle } from '../../types/ChatStyle.std.ts';

export type SmartChatColorPickerProps = Readonly<{
  conversationId: string | null;
}>;

export const SmartChatColorPicker = memo(function SmartChatColorPicker({
  conversationId,
}: SmartChatColorPickerProps) {
  const i18n = useSelector(getIntl);
  const customChatColors = useSelector(getCustomChatColors);
  const defaultBubbleColor = useSelector(getDefaultBubbleColor);
  const conversationSelector = useSelector(getConversationSelector);
  const conversationWithCustomColorSelector = useSelector(
    getConversationsWithCustomColorSelector
  );

  const { addCustomColor, removeCustomColor, editCustomColor } =
    useChatColorsActions();
  const { setGlobalDefaultBubbleColor, resetDefaultChatColor } =
    useAccountActions();
  const { colorSelected, resetAllChatColors } = useConversationsActions();

  const conversation =
    conversationId != null ? conversationSelector(conversationId) : null;

  const selectedBubbleColor = conversation?.bubbleColor ?? defaultBubbleColor;

  const getConversationsWithCustomColor = useCallback(
    (colorId: ChatStyle.CustomChatColorId): Array<ConversationType> => {
      return conversationWithCustomColorSelector(colorId);
    },
    [conversationWithCustomColorSelector]
  );

  return (
    <ChatColorPicker
      i18n={i18n}
      conversationId={conversationId}
      selectedBubbleColor={selectedBubbleColor}
      defaultBubbleColor={defaultBubbleColor}
      customChatColors={customChatColors}
      getConversationsWithCustomColor={getConversationsWithCustomColor}
      onAddCustomChatColor={addCustomColor}
      onSelectBubbleColor={colorSelected}
      onEditCustomChatColor={editCustomColor}
      onRemoveCustomChatColor={removeCustomColor}
      onResetAllChatColors={resetAllChatColors}
      onResetDefaultBubbleColor={resetDefaultChatColor}
      onChangeGlobalDefaultBubbleColor={setGlobalDefaultBubbleColor}
    />
  );
});
