import React, { ChangeEvent } from 'react';
import classNames from 'classnames';
import { QRCode } from 'react-qr-svg';

import { Avatar, AvatarSize } from '../avatar/Avatar';

import { PillDivider } from '../basic/PillDivider';
import { SyncUtils, ToastUtils, UserUtils } from '../../session/utils';

import { ConversationModel, ConversationTypeEnum } from '../../models/conversation';

import { getConversationController } from '../../session/conversations';
import { SpacerLG, SpacerMD } from '../basic/Text';
import autoBind from 'auto-bind';
import { editProfileModal } from '../../state/ducks/modalDialog';
import { uploadOurAvatar } from '../../interactions/conversationInteractions';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SessionSpinner } from '../basic/SessionSpinner';
import { SessionIconButton } from '../icon';
import { MAX_USERNAME_LENGTH } from '../registration/RegistrationStages';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { pickFileForAvatar } from '../../types/attachments/VisualAttachment';
import { sanitizeSessionUsername } from '../../session/utils/String';
import { setLastProfileUpdateTimestamp } from '../../util/storage';

interface State {
  profileName: string;
  setProfileName: string;
  oldAvatarPath: string;
  newAvatarObjectUrl: string | null;
  mode: 'default' | 'edit' | 'qr';
  loading: boolean;
}

const QRView = ({ sessionID }: { sessionID: string }) => {
  return (
    <div className="qr-image">
      <QRCode value={sessionID} bgColor="#FFFFFF" fgColor="#1B1B1B" level="L" />
    </div>
  );
};

export class EditProfileDialog extends React.Component<{}, State> {
  private readonly convo: ConversationModel;

  constructor(props: any) {
    super(props);

    autoBind(this);

    this.convo = getConversationController().get(UserUtils.getOurPubKeyStrFromCache());

    this.state = {
      profileName: this.convo.getProfileName() || '',
      setProfileName: this.convo.getProfileName() || '',
      oldAvatarPath: this.convo.getAvatarPath() || '',
      newAvatarObjectUrl: null,
      mode: 'default',
      loading: false,
    };
  }

  public componentDidMount() {
    window.addEventListener('keyup', this.onKeyUp);
  }

  public componentWillUnmount() {
    window.removeEventListener('keyup', this.onKeyUp);
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
              iconType: 'chevron',
              iconRotation: 90,
              onClick: () => {
                this.setState({ mode: 'default' });
              },
            },
          ]
        : undefined;

    return (
      <div className="edit-profile-dialog" data-testid="edit-profile-dialog">
        <SessionWrapperModal
          title={i18n('editProfileModalTitle')}
          onClose={this.closeDialog}
          headerIconButtons={backButton}
          showExitIcon={true}
        >
          <SpacerMD />

          {viewQR && <QRView sessionID={sessionID} />}
          {viewDefault && this.renderDefaultView()}
          {viewEdit && this.renderEditView()}

          <div className="session-id-section">
            <PillDivider text={window.i18n('yourSessionID')} />
            <p
              className={classNames('text-selectable', 'session-id-section-display')}
              data-testid="your-session-id"
            >
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
                  copySessionID(sessionID);
                }}
                dataTestId="copy-button-profile-update"
              />
            ) : (
              !this.state.loading && (
                <SessionButton
                  text={window.i18n('save')}
                  buttonType={SessionButtonType.BrandOutline}
                  buttonColor={SessionButtonColor.Green}
                  onClick={this.onClickOK}
                  disabled={this.state.loading}
                  dataTestId="save-button-profile-update"
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
            <div
              className="image-upload-section"
              role="button"
              onClick={this.fireInputEvent}
              data-testid="image-upload-section"
            />
            <div
              className="qr-view-button"
              onClick={() => {
                this.setState(state => ({ ...state, mode: 'qr' }));
              }}
              role="button"
            >
              <SessionIconButton iconType="qr" iconSize="small" iconColor={'rgb(0, 0, 0)'} />
            </div>
          </div>
        </div>
      </>
    );
  }

  private async fireInputEvent() {
    const scaledAvatarUrl = await pickFileForAvatar();

    if (scaledAvatarUrl) {
      this.setState({
        newAvatarObjectUrl: scaledAvatarUrl,
        mode: 'edit',
      });
    }
  }

  private renderDefaultView() {
    const name = this.state.setProfileName || this.state.profileName;
    return (
      <>
        {this.renderProfileHeader()}

        <div className="profile-name-uneditable">
          <p data-testid="your-profile-name">{name}</p>
          <SessionIconButton
            iconType="pencil"
            iconSize="medium"
            onClick={() => {
              this.setState({ mode: 'edit' });
            }}
            dataTestId="edit-profile-icon"
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
            data-testid="profile-name-input"
          />
        </div>
      </>
    );
  }

  private renderAvatar() {
    const { oldAvatarPath, newAvatarObjectUrl, profileName } = this.state;
    const userName = profileName || this.convo.id;

    return (
      <Avatar
        forcedAvatarPath={newAvatarObjectUrl || oldAvatarPath}
        forcedName={userName}
        size={AvatarSize.XL}
        pubkey={this.convo.id}
      />
    );
  }

  private onNameEdited(event: ChangeEvent<HTMLInputElement>) {
    const newName = sanitizeSessionUsername(event.target.value);
    this.setState({
      profileName: newName,
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

  /**
   * Tidy the profile name input text and save the new profile name and avatar
   */
  private onClickOK() {
    const { newAvatarObjectUrl, profileName } = this.state;
    const newName = profileName ? profileName.trim() : '';

    if (newName.length === 0 || newName.length > MAX_USERNAME_LENGTH) {
      return;
    }

    this.setState(
      {
        loading: true,
      },
      async () => {
        await commitProfileEdits(newName, newAvatarObjectUrl);
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
}

async function commitProfileEdits(newName: string, scaledAvatarUrl: string | null) {
  const ourNumber = UserUtils.getOurPubKeyStrFromCache();
  const conversation = await getConversationController().getOrCreateAndWait(
    ourNumber,
    ConversationTypeEnum.PRIVATE
  );

  if (scaledAvatarUrl?.length) {
    try {
      const blobContent = await (await fetch(scaledAvatarUrl)).blob();
      if (!blobContent || !blobContent.size) {
        throw new Error('Failed to fetch blob content from scaled avatar');
      }
      await uploadOurAvatar(await blobContent.arrayBuffer());
    } catch (error) {
      if (error.message && error.message.length) {
        ToastUtils.pushToastError('edit-profile', error.message);
      }
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
  await setLastProfileUpdateTimestamp(Date.now());
  await SyncUtils.forceSyncConfigurationNowIfNeeded(true);
}

function copySessionID(sessionID: string) {
  window.clipboard.writeText(sessionID);
  ToastUtils.pushCopiedToClipBoard();
}
