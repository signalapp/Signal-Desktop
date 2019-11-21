import React from 'react';

export type PropsType = {
  id: string;
  conversationId: string;
  isSelected: boolean;
  selectMessage?: (messageId: string, conversationId: string) => unknown;
};

export class InlineNotificationWrapper extends React.Component<PropsType> {
  public focusRef: React.RefObject<HTMLDivElement> = React.createRef();

  public setFocus = () => {
    const container = this.focusRef.current;

    if (container && !container.contains(document.activeElement)) {
      container.focus();
    }
  };

  public handleFocus = () => {
    // @ts-ignore
    if (window.getInteractionMode() === 'keyboard') {
      this.setSelected();
    }
  };

  public setSelected = () => {
    const { id, conversationId, selectMessage } = this.props;

    if (selectMessage) {
      selectMessage(id, conversationId);
    }
  };

  public componentDidMount() {
    const { isSelected } = this.props;
    if (isSelected) {
      this.setFocus();
    }
  }

  public componentDidUpdate(prevProps: PropsType) {
    if (!prevProps.isSelected && this.props.isSelected) {
      this.setFocus();
    }
  }

  public render() {
    const { children } = this.props;

    return (
      <div
        className="module-inline-notification-wrapper"
        tabIndex={0}
        ref={this.focusRef}
        onFocus={this.handleFocus}
      >
        {children}
      </div>
    );
  }
}
