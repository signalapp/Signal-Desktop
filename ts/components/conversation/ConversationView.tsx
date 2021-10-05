// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

export type PropsType = {
  renderCompositionArea: () => JSX.Element;
  renderConversationHeader: () => JSX.Element;
  renderTimeline: () => JSX.Element;
};

export const ConversationView = ({
  renderCompositionArea,
  renderConversationHeader,
  renderTimeline,
}: PropsType): JSX.Element => {
  return (
    <div className="ConversationView">
      <div className="ConversationView__header">
        {renderConversationHeader()}
      </div>
      <div className="ConversationView__pane main panel">
        <div className="ConversationView__timeline--container">
          <div aria-live="polite" className="ConversationView__timeline">
            {renderTimeline()}
          </div>
        </div>
        <div className="ConversationView__composition-area">
          {renderCompositionArea()}
        </div>
      </div>
    </div>
  );
};
