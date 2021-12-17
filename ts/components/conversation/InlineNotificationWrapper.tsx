// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

export type PropsType = {
  id: string;
  conversationId: string;
  isSelected: boolean;
  selectMessage?: (messageId: string, conversationId: string) => unknown;
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
    if (window.getInteractionMode() === 'keyboard') {
      this.setSelected();
    }
  };

  public setSelected = (): void => {
    const { id, conversationId, selectMessage } = this.props;

    if (selectMessage) {
      selectMessage(id, conversationId);
    }
  };

  public override componentDidMount(): void {
    const { isSelected } = this.props;
    if (isSelected) {
      this.setFocus();
    }
  }

  public override componentDidUpdate(prevProps: PropsType): void {
    const { isSelected } = this.props;

    if (!prevProps.isSelected && isSelected) {
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
