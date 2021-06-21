import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import { QRCode } from 'react-qr-svg';

import { Avatar, AvatarSize } from './Avatar';

import { SessionButton, SessionButtonColor, SessionButtonType } from './session/SessionButton';

import { SessionIconButton, SessionIconSize, SessionIconType } from './session/icon';
import { PillDivider } from './session/PillDivider';
import { SyncUtils, ToastUtils, UserUtils } from '../session/utils';
import { MAX_USERNAME_LENGTH } from './session/registration/RegistrationTabs';
import { SessionSpinner } from './session/SessionSpinner';
import { ConversationModel, ConversationTypeEnum } from '../models/conversation';

import { SessionWrapperModal } from './session/SessionWrapperModal';
import { AttachmentUtil } from '../util';
import { ConversationController } from '../session/conversations';
import { SpacerLG, SpacerMD } from './basic/Text';
import autoBind from 'auto-bind';
import { editProfileModal } from '../state/ducks/modalDialog';
import { uploadOurAvatar } from '../interactions/conversationInteractions';

interface State {
  profileName: string;
  setProfileName: string;
  avatar: string;
  mode: 'default' | 'edit' | 'qr';
  loading: boolean;
}

export class EditProfileDialog extends React.Component<{}, State> {
  private readonly inputEl: any;
  private readonly convo: ConversationModel;

  constructor(props: any) {
    super(props);

    autoBind(this);

    this.convo = ConversationController.getInstance().get(UserUtils.getOurPubKeyStrFromCache());

    this.state = {
      profileName: this.convo.getProfileName() || '',
      setProfileName: this.convo.getProfileName() || '',
      avatar: this.convo.getAvatarPath() || '',
      mode: 'default',
      loading: false,
    };

    this.inputEl = React.createRef();

    window.addEventListener('keyup', this.onKeyUp);
  }

  public render() {
    const i18n = window.i18n;

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
      <div className="edit-profile-dialog">
        <SessionWrapperModal
          title={i18n('editProfileModalTitle')}
          onClose={this.closeDialog}
          headerIconButtons={backButton}
          showExitIcon={true}
        >
          <SpacerMD />

          {viewQR && this.renderQRView(sessionID)}
          {viewDefault && this.renderDefaultView()}
          {viewEdit && this.renderEditView()}

          <div className="session-id-section">
            <PillDivider text={window.i18n('yourSessionID')} />
            <p className={classNames('text-selectable', 'session-id-section-display')}>
              {sessionID}
            </p>

            <SpacerLG />
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

            <SpacerLG />
          </div>
        </SessionWrapperModal>
      </div>
    );
  }

  private renderProfileHeader() {
    return (
      <>
        <div className="avatar-center">
          <div className="avatar-center-inner">
            {this.renderAvatar()}
            <div className="image-upload-section" role="button" onClick={this.fireInputEvent} />
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
                iconColor={'rgb(0, 0, 0)'}
                onClick={() => {
                  this.setState(state => ({ ...state, mode: 'qr' }));
                }}
              />
            </div>
          </div>
        </div>
      </>
    );
  }

  private fireInputEvent() {
    this.setState(
      state => ({ ...state, mode: 'edit' }),
      () => {
        const el = this.inputEl.current;
        if (el) {
          el.click();
        }
      }
    );
  }

  private renderDefaultView() {
    const name = this.state.setProfileName || this.state.profileName;
    return (
      <>
        {this.renderProfileHeader()}

        <div className="profile-name-uneditable">
          <p>{name}</p>
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
        <QRCode value={sessionID} bgColor={bgColor} fgColor={fgColor} level="L" />
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
    const userName = profileName || this.convo.id;

    return (
      <Avatar avatarPath={avatar} name={userName} size={AvatarSize.XL} pubkey={this.convo.id} />
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

  /**
   * Tidy the profile name input text and save the new profile name and avatar
   */
  private onClickOK() {
    const newName = this.state.profileName ? this.state.profileName.trim() : '';

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
        await this.commitProfileEdits(newName, avatar);
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

    window.inboxStore?.dispatch(editProfileModal(null));
  }

  private async commitProfileEdits(newName: string, avatar: any) {
    const ourNumber = UserUtils.getOurPubKeyStrFromCache();
    const conversation = await ConversationController.getInstance().getOrCreateAndWait(
      ourNumber,
      ConversationTypeEnum.PRIVATE
    );

    if (avatar) {
      const data = await AttachmentUtil.readFile({ file: avatar });
      // Ensure that this file is either small enough or is resized to meet our
      //   requirements for attachments
      try {
        const withBlob = await AttachmentUtil.autoScale(
          {
            contentType: avatar.type,
            file: new Blob([data.data], {
              type: avatar.contentType,
            }),
          },
          {
            maxSide: 640,
            maxSize: 1000 * 1024,
          }
        );
        const dataResized = await window.Signal.Types.Attachment.arrayBufferFromFile(withBlob.file);

        // For simplicity we use the same attachment pointer that would send to
        // others, which means we need to wait for the database response.
        // To avoid the wait, we create a temporary url for the local image
        // and use it until we the the response from the server
        // const tempUrl = window.URL.createObjectURL(avatar);
        // await conversation.setLokiProfile({ displayName: newName });
        // conversation.set('avatar', tempUrl);

        await uploadOurAvatar(dataResized);
      } catch (error) {
        window.log.error(
          'showEditProfileDialog Error ensuring that image is properly sized:',
          error && error.stack ? error.stack : error
        );
      }
      return;
    }
    // do not update the avatar if it did not change
    await conversation.setLokiProfile({
      displayName: newName,
    });
    // might be good to not trigger a sync if the name did not change
    await conversation.commit();
    UserUtils.setLastProfileUpdateTimestamp(Date.now());
    await SyncUtils.forceSyncConfigurationNowIfNeeded(true);
  }
}
