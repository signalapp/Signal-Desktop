import { ChangeEvent, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { Avatar, AvatarSize } from '../avatar/Avatar';

import { SyncUtils, ToastUtils, UserUtils } from '../../session/utils';
import { YourSessionIDPill, YourSessionIDSelectable } from '../basic/YourSessionIDPill';

import { useOurAvatarPath, useOurConversationUsername } from '../../hooks/useParamSelector';
import { ConversationTypeEnum } from '../../models/conversationAttributes';
import { MAX_NAME_LENGTH_BYTES } from '../../session/constants';
import { getConversationController } from '../../session/conversations';
import { sanitizeSessionUsername } from '../../session/utils/String';
import { editProfileModal, updateEditProfilePictureModel } from '../../state/ducks/modalDialog';
import { getTheme } from '../../state/selectors/theme';
import { getThemeValue } from '../../themes/globals';
import { setLastProfileUpdateTimestamp } from '../../util/storage';
import { SessionQRCode } from '../SessionQRCode';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { Flex } from '../basic/Flex';
import { SessionButton } from '../basic/SessionButton';
import { Spacer2XL, Spacer3XL, SpacerLG, SpacerSM, SpacerXL, SpacerXS } from '../basic/Text';
import { SessionIconButton } from '../icon';
import { SessionSpinner } from '../loading';

const StyledEditProfileDialog = styled.div`
  .session-modal {
    width: 468px;
    .session-modal__body {
      overflow: initial;
    }
  }

  .avatar-center-inner {
    position: relative;

    .qr-view-button {
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      position: absolute;
      top: -8px;
      right: -8px;
      height: 34px;
      width: 34px;
      border-radius: 50%;
      background-color: var(--white-color);
      transition: var(--default-duration);

      &:hover {
        filter: brightness(90%);
      }

      .session-icon-button {
        opacity: 1;
      }
    }
  }
`;

const StyledProfileName = styled(Flex)`
  input {
    height: 38px;
    border-radius: 5px;
    text-align: center;
    font-size: var(--font-size-md);
  }

  &.uneditable {
    p {
      margin: 0;
      padding: 0px var(--margins-lg) 0 var(--margins-sm);
    }

    .session-icon-button {
      padding: 0px;
    }
  }
`;

const StyledSessionIdSection = styled(Flex)`
  .session-button {
    width: 160px;
  }
`;

const QRView = ({ sessionID }: { sessionID: string }) => {
  const theme = useSelector(getTheme);

  return (
    <SessionQRCode
      id={'session-account-id'}
      value={sessionID}
      size={170}
      backgroundColor={getThemeValue(
        theme.includes('dark') ? '--text-primary-color' : '--background-primary-color'
      )}
      foregroundColor={getThemeValue(
        theme.includes('dark') ? '--background-primary-color' : '--text-primary-color'
      )}
      logoImage={'./images/session/qr/brand.svg'}
      logoWidth={40}
      logoHeight={40}
      logoIsSVG={true}
      theme={theme}
    />
  );
};

const updateDisplayName = async (newName: string) => {
  const ourNumber = UserUtils.getOurPubKeyStrFromCache();
  const conversation = await getConversationController().getOrCreateAndWait(
    ourNumber,
    ConversationTypeEnum.PRIVATE
  );
  conversation.setSessionDisplayNameNoCommit(newName);

  // might be good to not trigger a sync if the name did not change
  await conversation.commit();
  await setLastProfileUpdateTimestamp(Date.now());
  await SyncUtils.forceSyncConfigurationNowIfNeeded(true);
};

type ProfileAvatarProps = {
  avatarPath: string | null;
  newAvatarObjectUrl?: string | null;
  profileName: string | undefined;
  ourId: string;
};

export const ProfileAvatar = (props: ProfileAvatarProps) => {
  const { newAvatarObjectUrl, avatarPath, profileName, ourId } = props;
  return (
    <Avatar
      forcedAvatarPath={newAvatarObjectUrl || avatarPath}
      forcedName={profileName || ourId}
      size={AvatarSize.XL}
      pubkey={ourId}
    />
  );
};

type ProfileHeaderProps = ProfileAvatarProps & {
  onClick: () => void;
  setMode: (mode: ProfileDialogModes) => void;
};

const ProfileHeader = (props: ProfileHeaderProps) => {
  const { avatarPath, profileName, ourId, onClick, setMode } = props;

  return (
    <div className="avatar-center">
      <div className="avatar-center-inner">
        <ProfileAvatar avatarPath={avatarPath} profileName={profileName} ourId={ourId} />
        <div
          className="image-upload-section"
          role="button"
          onClick={onClick}
          data-testid="image-upload-section"
        />
        <div
          className="qr-view-button"
          onClick={() => {
            setMode('qr');
          }}
          role="button"
        >
          <SessionIconButton iconType="qr" iconSize={26} iconColor="var(--black-color)" />
        </div>
      </div>
    </div>
  );
};

type ProfileDialogModes = 'default' | 'edit' | 'qr';

export const EditProfileDialog = () => {
  const dispatch = useDispatch();

  const _profileName = useOurConversationUsername() || '';
  const [profileName, setProfileName] = useState(_profileName);
  const [updatedProfileName, setUpdateProfileName] = useState(profileName);
  const avatarPath = useOurAvatarPath() || '';
  const ourId = UserUtils.getOurPubKeyStrFromCache();

  const [mode, setMode] = useState<ProfileDialogModes>('default');
  const [loading, setLoading] = useState(false);

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

      if (newName.length === 0 || newName.length > MAX_NAME_LENGTH_BYTES) {
        return;
      }

      // this throw if the length in bytes is too long
      const sanitizedName = sanitizeSessionUsername(newName);
      const trimName = sanitizedName.trim();

      setUpdateProfileName(trimName);
      setLoading(true);

      await updateDisplayName(newName);
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
          void onClickOK();
        }
        break;
      case 'Esc':
      case 'Escape':
        closeDialog();
        break;
      default:
    }
  };

  const handleProfileHeaderClick = () => {
    closeDialog();
    dispatch(
      updateEditProfilePictureModel({
        avatarPath,
        profileName,
        ourId,
      })
    );
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
    /* The <div> element has a child <input> element that allows keyboard interaction
    We use edit-profile-default class to prevent the qr icon on the avatar from clipping
    */
    <StyledEditProfileDialog
      className="edit-profile-dialog"
      data-testid="edit-profile-dialog"
      onKeyUp={handleOnKeyUp}
    >
      <SessionWrapperModal
        title={window.i18n('editProfileModalTitle')}
        onClose={closeDialog}
        headerIconButtons={backButton}
        headerReverse={true}
        showExitIcon={true}
        additionalClassName={mode === 'default' ? 'edit-profile-default' : undefined}
      >
        {mode === 'qr' && (
          <>
            <QRView sessionID={ourId} />
            <SpacerXS />
          </>
        )}
        {mode === 'default' && (
          <>
            <SpacerSM />
            <ProfileHeader
              avatarPath={avatarPath}
              profileName={profileName}
              ourId={ourId}
              onClick={handleProfileHeaderClick}
              setMode={setMode}
            />
            <SpacerXL />
            <StyledProfileName
              container={true}
              justifyContent="center"
              alignItems="center"
              className="uneditable"
            >
              <SessionIconButton
                iconType="pencil"
                iconSize="large"
                onClick={() => {
                  setMode('edit');
                }}
                dataTestId="edit-profile-icon"
              />
              <p data-testid="your-profile-name">{updatedProfileName || profileName}</p>
            </StyledProfileName>
            <Spacer3XL />
          </>
        )}
        {mode === 'edit' && (
          <>
            <ProfileHeader
              avatarPath={avatarPath}
              profileName={profileName}
              ourId={ourId}
              onClick={handleProfileHeaderClick}
              setMode={setMode}
            />
            <StyledProfileName container={true} justifyContent="center" alignItems="center">
              {/* TODO swap with new session input */}
              <input
                type="text"
                value={profileName}
                placeholder={window.i18n('displayName')}
                onChange={onNameEdited}
                maxLength={MAX_NAME_LENGTH_BYTES}
                tabIndex={0}
                required={true}
                aria-required={true}
                data-testid="profile-name-input"
              />
            </StyledProfileName>
          </>
        )}

        <StyledSessionIdSection
          container={true}
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
          width="calc(100% - 80px)"
        >
          <SpacerLG />
          <YourSessionIDPill />
          <SpacerLG />
          <YourSessionIDSelectable />

          <SessionSpinner loading={loading} />
          <Spacer2XL />

          {mode === 'default' || mode === 'qr' ? (
            <Flex
              container={true}
              justifyContent={mode === 'default' ? 'space-between' : 'center'}
              alignItems="center"
              width={'100%'}
            >
              <SessionButton
                text={window.i18n('editMenuCopy')}
                onClick={() => {
                  window.clipboard.writeText(ourId);
                  ToastUtils.pushCopiedToClipBoard();
                }}
                dataTestId="copy-button-profile-update"
              />
              {mode === 'default' ? (
                <SessionButton
                  text={window.i18n('qrView')}
                  onClick={() => {
                    setMode('qr');
                  }}
                  dataTestId="qr-view-profile-update"
                />
              ) : null}
            </Flex>
          ) : (
            !loading && (
              <SessionButton
                text={window.i18n('save')}
                onClick={onClickOK}
                disabled={loading}
                dataTestId="save-button-profile-update"
              />
            )
          )}
          <SpacerSM />
        </StyledSessionIdSection>
      </SessionWrapperModal>
    </StyledEditProfileDialog>
  );
};
