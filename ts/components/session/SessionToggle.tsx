import React from 'react';
import classNames from 'classnames';

interface Props {
  active: boolean;
  onClick: any;
  // If you require the toggle to be confirmed, use
  // a confirmation dialog. The parameters needed in the
  // setting item in SessionSettings.tsx are like such:
  // confirmationDialogParams: {
  //  shouldShowConfirm: false,
  //  title: window.i18n('linkPreviewsConfirmTitle'),
  //  message: window.i18n('linkPreviewsConfirmMessage'),
  //  okTheme: 'danger',
  // }
  confirmationDialogParams?: any | undefined;
}

interface State {
  active: boolean;
}

export class SessionToggle extends React.PureComponent<Props, State> {
  public static defaultProps = {
    onClick: () => null,
  };

  constructor(props: any) {
    super(props);
    this.clickHandler = this.clickHandler.bind(this);

    const { active } = this.props;

    this.state = {
      active: active,
    };
  }

  public render() {
    return (
      <div
        className={classNames(
          'session-toggle',
          this.state.active ? 'active' : ''
        )}
        role="button"
        onClick={this.clickHandler}
      >
        <div className="knob" />
      </div>
    );
  }

  private clickHandler(event: any) {
    const stateManager = (e: any) => {
      this.setState({
        active: !this.state.active,
      });

      if (this.props.onClick) {
        e.stopPropagation();
        this.props.onClick();
      }
    };

    if (
      this.props.confirmationDialogParams &&
      this.props.confirmationDialogParams.shouldShowConfirm()
    ) {
      // If item needs a confirmation dialog to turn ON, render it
      window.confirmationDialog({
        resolve: () => {
          stateManager(event);
        },
        ...this.props.confirmationDialogParams,
      });

      return;
    }

    stateManager(event);
  }
}
