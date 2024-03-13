// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { ChatColorPicker } from '../../components/ChatColorPicker';
import {
  getConversationSelector,
  getConversationsWithCustomColorSelector,
} from '../selectors/conversations';
import { getIntl } from '../selectors/user';
import {
  getCustomColors,
  getDefaultConversationColor,
} from '../selectors/items';
import { getConversationColorAttributes } from '../../util/getConversationColorAttributes';
import {
  useConversationsActions,
  type ConversationType,
} from '../ducks/conversations';
import { useItemsActions } from '../ducks/items';

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
    async (colorId: string): Promise<Array<ConversationType>> => {
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
