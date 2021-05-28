// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';

import { mapDispatchToProps } from '../actions';
import {
  ChatColorPicker,
  PropsDataType,
} from '../../components/ChatColorPicker';
import { ConversationColorType, CustomColorType } from '../../types/Colors';
import { StateType } from '../reducer';
import {
  getConversationSelector,
  getConversationsWithCustomColorSelector,
  getMe,
} from '../selectors/conversations';
import { getIntl } from '../selectors/user';

export type SmartChatColorPickerProps = {
  conversationId?: string;
  isInModal?: boolean;
  onChatColorReset?: () => unknown;
  onSelectColor: (
    color: ConversationColorType,
    customColorData?: {
      id: string;
      value: CustomColorType;
    }
  ) => unknown;
};

const mapStateToProps = (
  state: StateType,
  props: SmartChatColorPickerProps
): PropsDataType => {
  const conversation = props.conversationId
    ? getConversationSelector(state)(props.conversationId)
    : getMe(state);

  const { customColors } = state.items;

  return {
    ...props,
    customColors: customColors ? customColors.colors : {},
    getConversationsWithCustomColor: getConversationsWithCustomColorSelector(
      state
    ),
    i18n: getIntl(state),
    selectedColor: conversation.conversationColor,
    selectedCustomColor: {
      id: conversation.customColorId,
      value: conversation.customColor,
    },
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartChatColorPicker = smart(ChatColorPicker);
