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
} from '../selectors/conversations';
import { getDefaultConversationColor } from '../selectors/items';
import { getIntl } from '../selectors/user';

export type SmartChatColorPickerProps = {
  conversationId?: string;
  isGlobal?: boolean;
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
  const defaultConversationColor = getDefaultConversationColor(state);
  const colorValues = props.conversationId
    ? getConversationSelector(state)(props.conversationId)
    : {
        conversationColor: defaultConversationColor.color,
        customColorId: defaultConversationColor.customColorData?.id,
        customColor: defaultConversationColor.customColorData?.value,
      };

  const { customColors } = state.items;

  return {
    ...props,
    customColors: customColors ? customColors.colors : {},
    getConversationsWithCustomColor: getConversationsWithCustomColorSelector(
      state
    ),
    i18n: getIntl(state),
    selectedColor: colorValues.conversationColor,
    selectedCustomColor: {
      id: colorValues.customColorId,
      value: colorValues.customColor,
    },
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartChatColorPicker = smart(ChatColorPicker);
