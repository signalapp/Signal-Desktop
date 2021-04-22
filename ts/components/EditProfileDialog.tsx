import React from 'react';
import classNames from 'classnames';
import { QRCode } from 'react-qr-svg';

import { Avatar, AvatarSize } from './Avatar';

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
import { ToastUtils, UserUtils } from '../session/utils';
import { DefaultTheme } from 'styled-components';
import { MAX_USERNAME_LENGTH } from './session/registration/RegistrationTabs';
import { SessionSpinner } from './session/SessionSpinner';

interface Props {
  i18n: any;
  profileName: string;
  avatarPath: string;
  pubkey: string;
  onClose: any;
  onOk: any;
  theme: DefaultTheme;
}

interface State {
  profileName: string;
  setProfileName: string;
  avatar: string;
  mode: 'default' | 'edit' | 'qr';
  loading: boolean;
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
      loading: false,
    };

    this.inputEl = React.createRef();

    window.addEventListener('keyup', this.onKeyUp);
  }

  public render() {
    const i18n = this.props.i18n;

    const viewDefault = this.state.mode === 'default';
    const viewEdit = this.state.mode === 'edit';
    const viewQR = this.state.mode === 'qr';

    const sessionID = UserUtils.getOurPubKeyStrFromCache();

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
        onClose={this.closeDialog}
        headerReverse={viewEdit || viewQR}
        headerIconButtons={backButton}
        theme={this.props.theme}
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
          <SessionSpinner loading={this.state.loading} />

          {viewDefault || viewQR ? (
            <SessionButton
              text={window.i18n('editMenuCopy')}
              buttonType={SessionButtonType.BrandOutline}
              buttonColor={SessionButtonColor.Green}
              onClick={() => {
                this.copySessionID(sessionID);
              }}
            />
          ) : (
            !this.state.loading && (
              <SessionButton
                text={window.i18n('save')}
                buttonType={SessionButtonType.BrandOutline}
                buttonColor={SessionButtonColor.Green}
                onClick={this.onClickOK}
                disabled={this.state.loading}
              />
            )
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
                theme={this.props.theme}
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
            theme={this.props.theme}
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
            maxLength={MAX_USERNAME_LENGTH}
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
    const { avatar, profileName } = this.state;
    const { pubkey } = this.props;
    const userName = profileName || pubkey;

    return (
      <Avatar
        avatarPath={avatar}
        name={userName}
        size={AvatarSize.XL}
        pubkey={pubkey}
      />
    );
  }

  private onNameEdited(event: any) {
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
    ToastUtils.pushCopiedToClipBoard();
  }

  private onClickOK() {
    const newName = this.state.profileName.trim();

    if (newName.length === 0 || newName.length > MAX_USERNAME_LENGTH) {
      return;
    }

    const avatar =
      this.inputEl &&
      this.inputEl.current &&
      this.inputEl.current.files &&
      this.inputEl.current.files.length > 0
        ? this.inputEl.current.files[0]
        : null;

    this.setState(
      {
        loading: true,
      },
      async () => {
        await this.props.onOk(newName, avatar);
        this.setState({
          loading: false,

          mode: 'default',
          setProfileName: this.state.profileName,
        });
      }
    );
  }

  private closeDialog() {
    window.removeEventListener('keyup', this.onKeyUp);

    this.props.onClose();
  }
}
