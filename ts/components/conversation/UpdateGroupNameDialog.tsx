import React from 'react';
import classNames from 'classnames';

import { SessionModal } from '../session/SessionModal';
import { SessionButton } from '../session/SessionButton';

interface Props {
  titleText: string;
  groupName: string;
  okText: string;
  cancelText: string;
  isAdmin: boolean;
  i18n: any;
  onSubmit: any;
  onClose: any;
  existingMembers: Array<String>;
}

interface State {
  groupName: string;
  errorDisplayed: boolean;
  errorMessage: string;
}

export class UpdateGroupNameDialog extends React.Component<Props, State> {
  constructor(props: any) {
    super(props);

    this.onClickOK = this.onClickOK.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.closeDialog = this.closeDialog.bind(this);
    this.onGroupNameChanged = this.onGroupNameChanged.bind(this);

    this.state = {
      groupName: this.props.groupName,
      errorDisplayed: false,
      errorMessage: 'placeholder',
    };

    window.addEventListener('keyup', this.onKeyUp);
  }

  public onClickOK() {
    if (!this.state.groupName.trim()) {
      this.onShowError(this.props.i18n('emptyGroupNameError'));

      return;
    }

    this.props.onSubmit(this.state.groupName, this.props.existingMembers);

    this.closeDialog();
  }

  public render() {
    const okText = this.props.okText;
    const cancelText = this.props.cancelText;

    let titleText;

    titleText = `${this.props.titleText}`;

    const errorMsg = this.state.errorMessage;
    const errorMessageClasses = classNames(
      'error-message',
      this.state.errorDisplayed ? 'error-shown' : 'error-faded'
    );

    return (
      <SessionModal
        title={titleText}
        // tslint:disable-next-line: no-void-expression
        onClose={() => this.closeDialog()}
        onOk={() => null}
      >
        <div className="spacer-md" />
        <p className={errorMessageClasses}>{errorMsg}</p>
        <div className="spacer-md" />

        <input
          type="text"
          className="profile-name-input"
          value={this.state.groupName}
          placeholder={this.props.i18n('groupNamePlaceholder')}
          onChange={this.onGroupNameChanged}
          tabIndex={0}
          required={true}
          aria-required={true}
          autoFocus={true}
          disabled={!this.props.isAdmin}
        />

        <div className="session-modal__button-group">
          <SessionButton text={okText} onClick={this.onClickOK} />

          <SessionButton text={cancelText} onClick={this.closeDialog} />
        </div>
      </SessionModal>
    );
  }

  private onShowError(msg: string) {
    if (this.state.errorDisplayed) {
      return;
    }

    this.setState({
      errorDisplayed: true,
      errorMessage: msg,
    });

    setTimeout(() => {
      this.setState({
        errorDisplayed: false,
      });
    }, 3000);
  }

  private onKeyUp(event: any) {
    switch (event.key) {
      case 'Enter':
        this.onClickOK();
        break;
      case 'Esc':
      case 'Escape':
        this.closeDialog();
        break;
      default:
    }
  }

  private closeDialog() {
    window.removeEventListener('keyup', this.onKeyUp);

    this.props.onClose();
  }

  private onGroupNameChanged(event: any) {
    event.persist();

    this.setState(state => {
      return {
        ...state,
        groupName: event.target.value,
      };
    });
  }
}
