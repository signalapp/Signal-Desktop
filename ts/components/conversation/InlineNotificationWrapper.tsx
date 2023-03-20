// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { getInteractionMode } from '../../services/InteractionMode';

export type PropsType = {
  id: string;
  conversationId: string;
  isTargeted: boolean;
  targetMessage?: (messageId: string, conversationId: string) => unknown;
};

export class InlineNotificationWrapper extends React.Component<PropsType> {
  public focusRef: React.RefObject<HTMLDivElement> = React.createRef();

  public setFocus = (): void => {
    const container = this.focusRef.current;

    if (container && !container.contains(document.activeElement)) {
      container.focus();
    }
  };

  public handleFocus = (): void => {
    if (getInteractionMode() === 'keyboard') {
      this.setTargeted();
    }
  };

  public setTargeted = (): void => {
    const { id, conversationId, targetMessage } = this.props;

    if (targetMessage) {
      targetMessage(id, conversationId);
    }
  };

  public override componentDidMount(): void {
    const { isTargeted } = this.props;
    if (isTargeted) {
      this.setFocus();
    }
  }

  public override componentDidUpdate(prevProps: PropsType): void {
    const { isTargeted } = this.props;

    if (!prevProps.isTargeted && isTargeted) {
      this.setFocus();
    }
  }

  public override render(): JSX.Element {
    const { children } = this.props;

    return (
      <div
        className="module-inline-notification-wrapper"
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        ref={this.focusRef}
        onFocus={this.handleFocus}
      >
        {children}
      </div>
    );
  }
}
