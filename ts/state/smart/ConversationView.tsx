// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { connect } from 'react-redux';
import type { CompositionAreaPropsType } from './CompositionArea';
import type { OwnProps as ConversationHeaderPropsType } from './ConversationHeader';
import type { StateType } from '../reducer';
import type { TimelinePropsType } from './Timeline';
import * as log from '../../logging/log';
import { ConversationView } from '../../components/conversation/ConversationView';
import { PanelType } from '../../types/Panels';
import { SmartChatColorPicker } from './ChatColorPicker';
import { SmartCompositionArea } from './CompositionArea';
import { SmartConversationHeader } from './ConversationHeader';
import { SmartTimeline } from './Timeline';
import { getTopPanelRenderableByReact } from '../selectors/conversations';
import { mapDispatchToProps } from '../actions';

export type PropsType = {
  conversationId: string;
  compositionAreaProps: Pick<
    CompositionAreaPropsType,
    | 'id'
    | 'onCancelJoinRequest'
    | 'onClearAttachments'
    | 'onClickAddPack'
    | 'onCloseLinkPreview'
    | 'onEditorStateChange'
    | 'onSelectMediaQuality'
    | 'onTextTooLong'
  >;
  conversationHeaderProps: ConversationHeaderPropsType;
  timelineProps: TimelinePropsType;
};

const mapStateToProps = (state: StateType, props: PropsType) => {
  const {
    compositionAreaProps,
    conversationHeaderProps,
    conversationId,
    timelineProps,
  } = props;

  const topPanel = getTopPanelRenderableByReact(state);

  return {
    conversationId,
    renderCompositionArea: () => (
      <SmartCompositionArea {...compositionAreaProps} />
    ),
    renderConversationHeader: () => (
      <SmartConversationHeader {...conversationHeaderProps} />
    ),
    renderTimeline: () => <SmartTimeline {...timelineProps} />,
    renderPanel: () => {
      if (!topPanel) {
        return;
      }

      if (topPanel.type === PanelType.ChatColorEditor) {
        return (
          <div className="panel">
            <SmartChatColorPicker conversationId={conversationId} />
          </div>
        );
      }

      const unknownPanelType: never = topPanel.type;
      log.warn(`renderPanel: Got unexpected panel type ${unknownPanelType}`);

      return undefined;
    },
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartConversationView = smart(ConversationView);
