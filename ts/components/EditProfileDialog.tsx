import React from 'react';
import classNames from 'classnames';
import { QRCode } from 'react-qr-svg';

import { Avatar } from './Avatar';

import {
  SessionButton,
  SessionButtonColor,
  SessionButtonType,
} from './session/SessionButton';

import {
  SessionIconButton,
  SessionIconSize,
  SessionIconType,
} from './session/icon';
import { SessionModal } from './session/SessionModal';
import { PillDivider } from './session/PillDivider';

declare global {
  interface Window {
    displayNameRegex: any;
  }
}

interface Props {
  callback: any;
  i18n: any;
  profileName: string;
  avatarPath: string;
  avatarColor: string;
  pubkey: string;
  onClose: any;
  onOk: any;
}

interface State {
  profileName: string;
  setProfileName: string;
  avatar: string;
  mode: 'default' | 'edit' | 'qr';
}

export class EditProfileDialog extends React.Component<Props, State> {
  private readonly inputEl: any;

  constructor(props: any) {
    super(props);

    this.onNameEdited = this.onNameEdited.bind(this);
    this.closeDialog = this.closeDialog.bind(this);
    this.onClickOK = this.onClickOK.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onFileSelected = this.onFileSelected.bind(this);
    this.fireInputEvent = this.fireInputEvent.bind(this);

    this.state = {
      profileName: this.props.profileName,
      setProfileName: this.props.profileName,
      avatar: this.props.avatarPath,
      mode: 'default',
    };

    this.inputEl = React.createRef();

    window.addEventListener('keyup', this.onKeyUp);
  }

  public render() {
    const i18n = this.props.i18n;

    const viewDefault = this.state.mode === 'default';
    const viewEdit = this.state.mode === 'edit';
    const viewQR = this.state.mode === 'qr';

    /* tslint:disable:no-backbone-get-set-outside-model */
    const sessionID =
      window.textsecure.storage.get('primaryDevicePubKey') ||
      window.textsecure.storage.user.getNumber();
    /* tslint:enable:no-backbone-get-set-outside-model */

    const backButton =
      viewEdit || viewQR
        ? [
            {
              iconType: SessionIconType.Chevron,
              iconRotation: 90,
              onClick: () => {
                this.setState({ mode: 'default' });
              },
            },
          ]
        : undefined;

    return (
      <SessionModal
        title={i18n('editProfileModalTitle')}
        onOk={this.onClickOK}
        onClose={this.closeDialog}
        headerReverse={viewEdit || viewQR}
        headerIconButtons={backButton}
      >
        <div className="spacer-md" />

        {viewQR && this.renderQRView(sessionID)}
        {viewDefault && this.renderDefaultView()}
        {viewEdit && this.renderEditView()}

        <div className="session-id-section">
          <PillDivider text={window.i18n('yourSessionID')} />
          <p
            className={classNames(
              'text-selectable',
              'session-id-section-display'
            )}
          >
            {sessionID}
          </p>

          <div className="spacer-lg" />

          {viewDefault || viewQR ? (
            <SessionButton
              text={window.i18n('copy')}
              buttonType={SessionButtonType.BrandOutline}
              buttonColor={SessionButtonColor.Green}
              onClick={() => {
                this.copySessionID(sessionID);
              }}
            />
          ) : (
            <SessionButton
              text={window.i18n('save')}
              buttonType={SessionButtonType.BrandOutline}
              buttonColor={SessionButtonColor.White}
              onClick={this.onClickOK}
            />
          )}

          <div className="spacer-lg" />
        </div>
      </SessionModal>
    );
  }

  private renderProfileHeader() {
    return (
      <>
        <div className="avatar-center">
          <div className="avatar-center-inner">
            {this.renderAvatar()}
            <div
              className="image-upload-section"
              role="button"
              onClick={this.fireInputEvent}
            />
            <input
              type="file"
              ref={this.inputEl}
              className="input-file"
              placeholder="input file"
              name="name"
              onChange={this.onFileSelected}
            />
            <div className="qr-view-button">
              <SessionIconButton
                iconType={SessionIconType.QR}
                iconSize={SessionIconSize.Small}
                iconColor={'#000000'}
                onClick={() => {
                  this.setState({ mode: 'qr' });
                }}
              />
            </div>
          </div>
        </div>
      </>
    );
  }

  private fireInputEvent() {
    this.setState({ mode: 'edit' }, () => {
      const el = this.inputEl.current;
      if (el) {
        el.click();
      }
    });
  }

  private renderDefaultView() {
    return (
      <>
        {this.renderProfileHeader()}

        <div className="profile-name-uneditable">
          <p>{this.state.setProfileName}</p>
          <SessionIconButton
            iconType={SessionIconType.Pencil}
            iconSize={SessionIconSize.Medium}
            onClick={() => {
              this.setState({ mode: 'edit' });
            }}
          />
        </div>
      </>
    );
  }

  private renderEditView() {
    const placeholderText = window.i18n('displayName');

    return (
      <>
        {this.renderProfileHeader()}
        <div className="profile-name">
          <input
            type="text"
            className="profile-name-input"
            value={this.state.profileName}
            placeholder={placeholderText}
            onChange={this.onNameEdited}
            maxLength={window.CONSTANTS.MAX_USERNAME_LENGTH}
            tabIndex={0}
            required={true}
            aria-required={true}
          />
        </div>
      </>
    );
  }

  private renderQRView(sessionID: string) {
    const bgColor = '#FFFFFF';
    const fgColor = '#1B1B1B';

    return (
      <div className="qr-image">
        <QRCode
          value={sessionID}
          bgColor={bgColor}
          fgColor={fgColor}
          level="L"
        />
      </div>
    );
  }

  private onFileSelected() {
    const file = this.inputEl.current.files[0];
    const url = window.URL.createObjectURL(file);

    this.setState({
      avatar: url,
    });
  }

  private renderAvatar() {
    const avatarPath = this.state.avatar;
    const color = this.props.avatarColor;

    return (
      <Avatar
        avatarPath={avatarPath}
        color={color}
        conversationType="direct"
        i18n={this.props.i18n}
        name={this.state.profileName}
        phoneNumber={this.props.pubkey}
        profileName={this.state.profileName}
        size={80}
      />
    );
  }

  private onNameEdited(event: any) {
    event.persist();

    const newName = event.target.value.replace(window.displayNameRegex, '');

    this.setState(state => {
      return {
        ...state,
        profileName: newName,
      };
    });
  }

  private onKeyUp(event: any) {
    switch (event.key) {
      case 'Enter':
        if (this.state.mode === 'edit') {
          this.onClickOK();
        }
        break;
      case 'Esc':
      case 'Escape':
        this.closeDialog();
        break;
      default:
    }
  }

  private copySessionID(sessionID: string) {
    window.clipboard.writeText(sessionID);

    window.pushToast({
      title: window.i18n('copiedSessionID'),
      type: 'success',
      id: 'copiedSessionID',
    });
  }

  private onClickOK() {
    const newName = this.state.profileName.trim();

    if (
      newName.length === 0 ||
      newName.length > window.CONSTANTS.MAX_USERNAME_LENGTH
    ) {
      return;
    }

    const avatar =
      this.inputEl &&
      this.inputEl.current &&
      this.inputEl.current.files &&
      this.inputEl.current.files.length > 0
        ? this.inputEl.current.files[0]
        : null;

    this.props.onOk(newName, avatar);

    this.setState(
      {
        mode: 'default',
        setProfileName: this.state.profileName,
      },
      () => {
        // Update settinngs in dialog complete;
        // now callback to reloadactions panel avatar
        this.props.callback(this.state.avatar);
      }
    );
  }

  private closeDialog() {
    window.removeEventListener('keyup', this.onKeyUp);

    this.props.onClose();
  }
}
