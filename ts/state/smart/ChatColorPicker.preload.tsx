// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { ChatColorPicker } from '../../components/ChatColorPicker.dom.tsx';
import {
  getConversationSelector,
  getConversationsWithCustomColorSelector,
} from '../selectors/conversations.dom.ts';
import { getIntl } from '../selectors/user.std.ts';
import {
  getCustomColors,
  getDefaultConversationColor,
} from '../selectors/items.dom.ts';
import { getConversationColorAttributes } from '../../util/getConversationColorAttributes.std.ts';
import {
  useConversationsActions,
  type ConversationType,
} from '../ducks/conversations.preload.ts';
import { useItemsActions } from '../ducks/items.preload.ts';

export type SmartChatColorPickerProps = Readonly<{
  conversationId?: string;
}>;

export const SmartChatColorPicker = memo(function SmartChatColorPicker({
  conversationId,
}: SmartChatColorPickerProps) {
  const i18n = useSelector(getIntl);
  const customColors = useSelector(getCustomColors) ?? {};
  const defaultConversationColor = useSelector(getDefaultConversationColor);
  const conversationSelector = useSelector(getConversationSelector);
  const conversationWithCustomColorSelector = useSelector(
    getConversationsWithCustomColorSelector
  );

  const {
    addCustomColor,
    removeCustomColor,
    setGlobalDefaultConversationColor,
    resetDefaultChatColor,
    editCustomColor,
  } = useItemsActions();
  const {
    colorSelected,
    resetAllChatColors,
    removeCustomColorOnConversations,
  } = useConversationsActions();

  const conversation = conversationId
    ? conversationSelector(conversationId)
    : {};

  const colorValues = getConversationColorAttributes(
    conversation,
    defaultConversationColor
  );

  const selectedColor = colorValues.conversationColor;
  const selectedCustomColor = {
    id: colorValues.customColorId,
    value: colorValues.customColor,
  };

  const getConversationsWithCustomColor = useCallback(
    (colorId: string): Array<ConversationType> => {
      return conversationWithCustomColorSelector(colorId);
    },
    [conversationWithCustomColorSelector]
  );

  return (
    <ChatColorPicker
      addCustomColor={addCustomColor}
      colorSelected={colorSelected}
      conversationId={conversationId}
      customColors={customColors}
      editCustomColor={editCustomColor}
      getConversationsWithCustomColor={getConversationsWithCustomColor}
      i18n={i18n}
      isGlobal={false}
      removeCustomColor={removeCustomColor}
      removeCustomColorOnConversations={removeCustomColorOnConversations}
      resetAllChatColors={resetAllChatColors}
      resetDefaultChatColor={resetDefaultChatColor}
      selectedColor={selectedColor}
      selectedCustomColor={selectedCustomColor}
      setGlobalDefaultConversationColor={setGlobalDefaultConversationColor}
    />
  );
});
