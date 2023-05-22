import React, { ChangeEvent, MouseEvent, ReactElement, useState } from 'react';
import { QRCode } from 'react-qr-svg';

import { Avatar, AvatarSize } from '../avatar/Avatar';

import { SyncUtils, ToastUtils, UserUtils } from '../../session/utils';
import { YourSessionIDPill, YourSessionIDSelectable } from '../basic/YourSessionIDPill';
import styled from 'styled-components';
import { uploadOurAvatar } from '../../interactions/conversationInteractions';
import { ConversationTypeEnum } from '../../models/conversationAttributes';
import { MAX_USERNAME_BYTES } from '../../session/constants';
import { getConversationController } from '../../session/conversations';
import { editProfileModal } from '../../state/ducks/modalDialog';
import { pickFileForAvatar } from '../../types/attachments/VisualAttachment';
import { saveQRCode } from '../../util/saveQRCode';
import { setLastProfileUpdateTimestamp } from '../../util/storage';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { SessionButton, SessionButtonType } from '../basic/SessionButton';
import { SessionSpinner } from '../basic/SessionSpinner';
import { SessionIconButton } from '../icon';
import { sanitizeSessionUsername } from '../../session/utils/String';
import { useOurConversationUsername } from '../../hooks/useParamSelector';
import { useOurAvatarPath } from '../../hooks/useParamSelector';

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

const commitProfileEdits = async (newName: string, scaledAvatarUrl: string | null) => {
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
};

type ProfileAvatarProps = {
  newAvatarObjectUrl: string | null;
  oldAvatarPath: string | null;
  profileName: string | undefined;
  ourId: string;
};

const ProfileAvatar = (props: ProfileAvatarProps): ReactElement => {
  const { newAvatarObjectUrl, oldAvatarPath, profileName, ourId } = props;
  return (
    <Avatar
      forcedAvatarPath={newAvatarObjectUrl || oldAvatarPath}
      forcedName={profileName || ourId}
      size={AvatarSize.XL}
      pubkey={ourId}
    />
  );
};

type ProfileHeaderProps = ProfileAvatarProps & {
  fireInputEvent: () => void;
  setMode: (mode: ProfileDialogModes) => void;
};

const ProfileHeader = (props: ProfileHeaderProps): ReactElement => {
  const { newAvatarObjectUrl, oldAvatarPath, profileName, ourId, fireInputEvent, setMode } = props;

  return (
    <div className="avatar-center">
      <div className="avatar-center-inner">
        <ProfileAvatar
          newAvatarObjectUrl={newAvatarObjectUrl}
          oldAvatarPath={oldAvatarPath}
          profileName={profileName}
          ourId={ourId}
        />
        <div
          className="image-upload-section"
          role="button"
          onClick={async () => {
            void fireInputEvent();
          }}
          data-testid="image-upload-section"
        />
        <div
          className="qr-view-button"
          onClick={() => {
            setMode('qr');
          }}
          role="button"
        >
          <SessionIconButton iconType="qr" iconSize="small" iconColor="var(--black-color)" />
        </div>
      </div>
    </div>
  );
};

type ProfileDialogModes = 'default' | 'edit' | 'qr';

export const EditProfileDialog = (): ReactElement => {
  const _profileName = useOurConversationUsername() || '';
  const [profileName, setProfileName] = useState(_profileName);
  const [updatedProfileName, setUpdateProfileName] = useState(profileName);
  const oldAvatarPath = useOurAvatarPath() || '';
  const [newAvatarObjectUrl, setNewAvatarObjectUrl] = useState<string | null>(null);

  const [mode, setMode] = useState<ProfileDialogModes>('default');
  const [loading, setLoading] = useState(false);

  const ourId = UserUtils.getOurPubKeyStrFromCache();

  const closeDialog = () => {
    window.removeEventListener('keyup', handleOnKeyUp);
    window.inboxStore?.dispatch(editProfileModal(null));
  };

  const backButton =
    mode === 'edit' || mode === 'qr'
      ? [
          {
            iconType: 'chevron',
            iconRotation: 90,
            onClick: () => {
              setMode('default');
            },
          },
        ]
      : undefined;

  const onClickOK = async () => {
    /**
     * Tidy the profile name input text and save the new profile name and avatar
     */
    try {
      const newName = profileName ? profileName.trim() : '';

      if (newName.length === 0 || newName.length > MAX_USERNAME_BYTES) {
        return;
      }

      // this throw if the length in bytes is too long
      const sanitizedName = sanitizeSessionUsername(newName);
      const trimName = sanitizedName.trim();

      setUpdateProfileName(trimName);
      setLoading(true);

      await commitProfileEdits(newName, newAvatarObjectUrl);
      setMode('default');
      setUpdateProfileName(profileName);
      setLoading(false);
    } catch (e) {
      ToastUtils.pushToastError('nameTooLong', window.i18n('displayNameTooLong'));
    }
  };

  const handleOnKeyUp = (event: any) => {
    switch (event.key) {
      case 'Enter':
        if (mode === 'edit') {
          onClickOK();
        }
        break;
      case 'Esc':
      case 'Escape':
        closeDialog();
        break;
      default:
    }
  };

  const fireInputEvent = async () => {
    const scaledAvatarUrl = await pickFileForAvatar();
    if (scaledAvatarUrl) {
      setNewAvatarObjectUrl(scaledAvatarUrl);
      setMode('edit');
    }
  };

  const onNameEdited = (event: ChangeEvent<HTMLInputElement>) => {
    const displayName = event.target.value;
    try {
      const newName = sanitizeSessionUsername(displayName);
      setProfileName(newName);
    } catch (e) {
      setProfileName(displayName);
      ToastUtils.pushToastError('nameTooLong', window.i18n('displayNameTooLong'));
    }
  };

  return (
    <div className="edit-profile-dialog" data-testid="edit-profile-dialog" onKeyUp={handleOnKeyUp}>
      <SessionWrapperModal
        title={window.i18n('editProfileModalTitle')}
        onClose={closeDialog}
        headerIconButtons={backButton}
        showExitIcon={true}
      >
        {mode === 'qr' && <QRView sessionID={ourId} />}
        {mode === 'default' && (
          <>
            <ProfileHeader
              newAvatarObjectUrl={newAvatarObjectUrl}
              oldAvatarPath={oldAvatarPath}
              profileName={profileName}
              ourId={ourId}
              fireInputEvent={fireInputEvent}
              setMode={setMode}
            />
            <div className="profile-name-uneditable">
              <p data-testid="your-profile-name">{updatedProfileName || profileName}</p>
              <SessionIconButton
                iconType="pencil"
                iconSize="medium"
                onClick={() => {
                  setMode('edit');
                }}
                dataTestId="edit-profile-icon"
              />
            </div>
          </>
        )}
        {mode === 'edit' && (
          <>
            <ProfileHeader
              newAvatarObjectUrl={newAvatarObjectUrl}
              oldAvatarPath={oldAvatarPath}
              profileName={profileName}
              ourId={ourId}
              fireInputEvent={fireInputEvent}
              setMode={setMode}
            />
            <div className="profile-name">
              <input
                type="text"
                className="profile-name-input"
                value={profileName}
                placeholder={window.i18n('displayName')}
                onChange={onNameEdited}
                maxLength={MAX_USERNAME_BYTES}
                tabIndex={0}
                required={true}
                aria-required={true}
                data-testid="profile-name-input"
              />
            </div>
          </>
        )}

        <div className="session-id-section">
          <YourSessionIDPill />
          <YourSessionIDSelectable />

          <SessionSpinner loading={loading} />

          {mode === 'default' || mode === 'qr' ? (
            <SessionButton
              text={window.i18n('editMenuCopy')}
              buttonType={SessionButtonType.Simple}
              onClick={() => {
                window.clipboard.writeText(ourId);
                ToastUtils.pushCopiedToClipBoard();
              }}
              dataTestId="copy-button-profile-update"
            />
          ) : (
            !loading && (
              <SessionButton
                text={window.i18n('save')}
                buttonType={SessionButtonType.Simple}
                onClick={onClickOK}
                disabled={loading}
                dataTestId="save-button-profile-update"
              />
            )
          )}
        </div>
      </SessionWrapperModal>
    </div>
  );
};
