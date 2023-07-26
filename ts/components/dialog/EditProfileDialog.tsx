import autoBind from 'auto-bind';
import React, { ChangeEvent, MouseEvent } from 'react';
import { QRCode } from 'react-qr-svg';
import styled from 'styled-components';
import { Avatar, AvatarSize } from '../avatar/Avatar';

import { SyncUtils, ToastUtils, UserUtils } from '../../session/utils';
import { YourSessionIDPill, YourSessionIDSelectable } from '../basic/YourSessionIDPill';

import { ConversationModel } from '../../models/conversation';

import { uploadOurAvatar } from '../../interactions/conversationInteractions';
import { ConversationTypeEnum } from '../../models/conversationAttributes';
import { MAX_USERNAME_BYTES } from '../../session/constants';
import { getConversationController } from '../../session/conversations';
import { sanitizeSessionUsername } from '../../session/utils/String';
import { editProfileModal } from '../../state/ducks/modalDialog';
import { pickFileForAvatar } from '../../types/attachments/VisualAttachment';
import { saveQRCode } from '../../util/saveQRCode';
import { setLastProfileUpdateTimestamp } from '../../util/storage';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { SessionButton, SessionButtonType } from '../basic/SessionButton';
import { SessionSpinner } from '../basic/SessionSpinner';
import { SessionIconButton } from '../icon';

const handleSaveQRCode = (event: MouseEvent) => {
  event.preventDefault();
  saveQRCode('session-id', '220px', '220px', 'var(--white-color)', 'var(--black-color)');
};

const StyledQRView = styled.div`
  cursor: pointer;
`;

const QRView = ({ sessionID }: { sessionID: string }) => {
  return (
    <StyledQRView
      aria-label={window.i18n('clickToTrustContact')}
      title={window.i18n('clickToTrustContact')}
      className="qr-image"
      onClick={handleSaveQRCode}
    >
      <QRCode
        value={sessionID}
        bgColor="var(--white-color)"
        fgColor="var(--black-color)"
        level="L"
      />
    </StyledQRView>
  );
};

interface State {
  profileName: string;
  updatedProfileName: string;
  oldAvatarPath: string;
  newAvatarObjectUrl: string | null;
  mode: 'default' | 'edit' | 'qr';
  loading: boolean;
}

export class EditProfileDialog extends React.Component<object, State> {
  private readonly convo: ConversationModel;

  constructor(props: object) {
    super(props);

    autoBind(this);

    this.convo = getConversationController().get(UserUtils.getOurPubKeyStrFromCache());

    this.state = {
      profileName: this.convo.getRealSessionUsername() || '',
      updatedProfileName: this.convo.getRealSessionUsername() || '',
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
          {viewQR && <QRView sessionID={sessionID} />}
          {viewDefault && this.renderDefaultView()}
          {viewEdit && this.renderEditView()}

          <div className="session-id-section">
            <YourSessionIDPill />
            <YourSessionIDSelectable />

            <SessionSpinner loading={this.state.loading} />

            {viewDefault || viewQR ? (
              <SessionButton
                text={window.i18n('editMenuCopy')}
                buttonType={SessionButtonType.Simple}
                onClick={() => {
                  window.clipboard.writeText(sessionID);
                  ToastUtils.pushCopiedToClipBoard();
                }}
                dataTestId="copy-button-profile-update"
              />
            ) : (
              !this.state.loading && (
                <SessionButton
                  text={window.i18n('save')}
                  buttonType={SessionButtonType.Simple}
                  onClick={this.onClickOK}
                  disabled={this.state.loading}
                  dataTestId="save-button-profile-update"
                />
              )
            )}
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
              onClick={() => void this.fireInputEvent()}
              data-testid="image-upload-section"
            />
            <div
              className="qr-view-button"
              onClick={() => {
                this.setState(state => ({ ...state, mode: 'qr' }));
              }}
              role="button"
            >
              <SessionIconButton iconType="qr" iconSize="small" iconColor="var(--black-color)" />
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
    const name = this.state.updatedProfileName || this.state.profileName;
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
            maxLength={MAX_USERNAME_BYTES}
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
    const displayName = event.target.value;
    try {
      const newName = sanitizeSessionUsername(displayName);
      this.setState({
        profileName: newName,
      });
    } catch (e) {
      this.setState({
        profileName: displayName,
      });
      ToastUtils.pushToastError('nameTooLong', window.i18n('displayNameTooLong'));
    }
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
    try {
      const newName = profileName ? profileName.trim() : '';

      if (newName.length === 0 || newName.length > MAX_USERNAME_BYTES) {
        return;
      }

      // this throw if the length in bytes is too long
      const sanitizedName = sanitizeSessionUsername(newName);
      const trimName = sanitizedName.trim();

      this.setState(
        {
          profileName: trimName,
          loading: true,
        },
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        async () => {
          await commitProfileEdits(newName, newAvatarObjectUrl);
          this.setState({
            loading: false,

            mode: 'default',
            updatedProfileName: this.state.profileName,
          });
        }
      );
    } catch (e) {
      ToastUtils.pushToastError('nameTooLong', window.i18n('displayNameTooLong'));
    }
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
  conversation.setSessionDisplayNameNoCommit(newName);

  // might be good to not trigger a sync if the name did not change
  await conversation.commit();
  await setLastProfileUpdateTimestamp(Date.now());
  await SyncUtils.forceSyncConfigurationNowIfNeeded(true);
}
