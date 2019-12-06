import React from 'react';
import { SessionButton, SessionButtonTypes } from './SessionButton';
import { AccentText } from './AccentText';
import { SessionInput } from './SessionInput';
//import classNames from 'classnames';

import { LocalizerType } from '../../types/Util';

declare global {
  interface Window {
    displayNameRegex: any;
  }
}

interface Props {
  showSubtitle: boolean;
  i18n: LocalizerType;
  /* profileName: string;
  avatarPath: string;
  avatarColor: string;
  pubkey: string;
  onClose: any;
  onStartConversation: any; */
}
/*
interface State {
  avatarColor: string;
} */

export class SessionRegistrationView extends React.Component<Props> {
  constructor(props: Props) {
    super(props);

    //this.closeDialog = this.closeDialog.bind(this);
    window.addEventListener('keyup', this.onKeyUp);
  }

  public render() {
    //const i18n = this.props.i18n;
    //const cancelText = i18n('cancel');

    const { showSubtitle } = this.props;

    return (
      <div className="session-content">
        <div className="session-content-accent">
          <AccentText showSubtitle={showSubtitle || true} />
        </div>
        <div className="session-content-registration">
          <div className="entry-fields">
            <SessionInput
              label="Mnemonic Seed"
              type="password"
              placeholder="Enter Seed"
              i18n={this.props.i18n}
              enableShowHide={true}
            />
            <SessionInput
              label="Display Name"
              type="text"
              placeholder="Enter Optional Display Name"
              i18n={this.props.i18n}
            />
            <SessionInput
              label="Optional Password"
              type="password"
              placeholder="Enter Optional Password"
              i18n={this.props.i18n}
            />
            <SessionInput
              label="Verify Password"
              type="password"
              placeholder="Optional Password"
              i18n={this.props.i18n}
            />
          </div>

          <SessionButton
            onClick={() => {
              alert('TODO');
            }}
            buttonType={SessionButtonTypes.FullGreen}
            text="Continue Your Session"
          />
          <div>or</div>
          <SessionButton
            onClick={() => {
              alert('TODO');
            }}
            buttonType={SessionButtonTypes.White}
            text="Link Device To Existing Account"
          />
        </div>
      </div>
    );
  }

  /*private renderAvatar() {
    const avatarPath = this.props.avatarPath;
    const color = this.props.avatarColor;

    return (
      <Avatar
        avatarPath={avatarPath}
        color={color}
        conversationType="direct"
        i18n={this.props.i18n}
        name={this.props.profileName}
        phoneNumber={this.props.pubkey}
        profileName={this.props.profileName}
        size={80}
      />
    );
  }
*/
  private onKeyUp(event: any) {
    switch (event.key) {
      case 'Enter':
        break;
      case 'Esc':
      case 'Escape':
        //this.closeDialog();
        break;
      default:
    }
  }

  /*rivate closeDialog() {
    window.removeEventListener('keyup', this.onKeyUp);
    this.props.onClose();
  }
*/
}
