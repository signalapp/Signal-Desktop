// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { ConversationView } from '../../components/conversation/ConversationView';
import type { StateType } from '../reducer';
import type { CompositionAreaPropsType } from './CompositionArea';
import { SmartCompositionArea } from './CompositionArea';
import type { OwnProps as ConversationHeaderPropsType } from './ConversationHeader';
import { SmartConversationHeader } from './ConversationHeader';
import type { TimelinePropsType } from './Timeline';
import { SmartTimeline } from './Timeline';

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
    | 'openConversation'
  >;
  conversationHeaderProps: ConversationHeaderPropsType;
  timelineProps: TimelinePropsType;
};

const mapStateToProps = (_state: StateType, props: PropsType) => {
  const {
    compositionAreaProps,
    conversationHeaderProps,
    conversationId,
    timelineProps,
  } = props;

  return {
    conversationId,
    renderCompositionArea: () => (
      <SmartCompositionArea {...compositionAreaProps} />
    ),
    renderConversationHeader: () => (
      <SmartConversationHeader {...conversationHeaderProps} />
    ),
    renderTimeline: () => <SmartTimeline {...timelineProps} />,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartConversationView = smart(ConversationView);
