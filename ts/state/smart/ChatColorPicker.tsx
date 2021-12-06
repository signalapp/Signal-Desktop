// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';

import { mapDispatchToProps } from '../actions';
import type { PropsDataType } from '../../components/ChatColorPicker';
import { ChatColorPicker } from '../../components/ChatColorPicker';
import type { StateType } from '../reducer';
import {
  getConversationSelector,
  getConversationsWithCustomColorSelector,
} from '../selectors/conversations';
import { getIntl } from '../selectors/user';
import { getConversationColorAttributes } from '../../util/getConversationColorAttributes';

export type SmartChatColorPickerProps = {
  conversationId?: string;
};

const mapStateToProps = (
  state: StateType,
  props: SmartChatColorPickerProps
): PropsDataType => {
  const conversation = props.conversationId
    ? getConversationSelector(state)(props.conversationId)
    : {};
  const colorValues = getConversationColorAttributes(conversation);

  const { customColors } = state.items;

  return {
    ...props,
    customColors: customColors ? customColors.colors : {},
    getConversationsWithCustomColor: (colorId: string) =>
      Promise.resolve(getConversationsWithCustomColorSelector(state)(colorId)),
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
