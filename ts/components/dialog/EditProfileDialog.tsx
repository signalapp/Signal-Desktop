import { isEmpty } from 'lodash';
import { useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useKey } from 'react-use';
import styled from 'styled-components';
import { Avatar, AvatarSize } from '../avatar/Avatar';

import { SyncUtils, UserUtils } from '../../session/utils';
import { YourSessionIDPill, YourSessionIDSelectable } from '../basic/YourSessionIDPill';

import { useOurAvatarPath, useOurConversationUsername } from '../../hooks/useParamSelector';
import { ConversationTypeEnum } from '../../models/conversationAttributes';
import { getConversationController } from '../../session/conversations';
import { editProfileModal, updateEditProfilePictureModel } from '../../state/ducks/modalDialog';
import { getTheme } from '../../state/selectors/theme';
import { getThemeValue } from '../../themes/globals';
import { setLastProfileUpdateTimestamp } from '../../util/storage';
import { SessionQRCode } from '../SessionQRCode';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { Flex } from '../basic/Flex';
import { SessionButton } from '../basic/SessionButton';
import { Spacer2XL, Spacer3XL, SpacerLG, SpacerSM, SpacerXL } from '../basic/Text';
import { CopyToClipboardButton } from '../buttons/CopyToClipboardButton';
import { SessionIconButton } from '../icon';
import { SessionInput } from '../inputs';
import { SessionSpinner } from '../loading';
import { sanitizeDisplayNameOrToast } from '../registration/utils';

const StyledEditProfileDialog = styled.div`
  .session-modal {
    width: 468px;
    .session-modal__body {
      width: calc(100% - 80px);
      margin: 0 auto;
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

  input {
    border: none;
  }
`;

// We center the name in the modal by offsetting the pencil icon
// we have a transparent border to match the dimensions of the SessionInput
const StyledProfileName = styled(Flex)`
  margin-inline-start: calc((25px + var(--margins-sm)) * -1);
  padding: 8px;
  border: 1px solid var(--transparent-color);
  p {
    font-size: var(--font-size-xl);
    line-height: 1.4;
    margin: 0;
    padding: 0px;
  }

  .session-icon-button {
    padding: 0px;
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
      style={{ marginTop: '-1px' }}
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
  onQRClick: () => void;
};

const ProfileHeader = (props: ProfileHeaderProps) => {
  const { avatarPath, profileName, ourId, onClick, onQRClick } = props;

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
        <div className="qr-view-button" onClick={onQRClick} role="button">
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
  const [profileNameError, setProfileNameError] = useState<string | undefined>(undefined);

  const copyButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const avatarPath = useOurAvatarPath() || '';
  const ourId = UserUtils.getOurPubKeyStrFromCache();

  const [mode, setMode] = useState<ProfileDialogModes>('default');
  const [loading, setLoading] = useState(false);

  const closeDialog = (event?: any) => {
    if (event?.key || loading) {
      return;
    }
    window.inboxStore?.dispatch(editProfileModal(null));
  };

  const backButton =
    mode === 'edit' || mode === 'qr'
      ? [
          {
            iconType: 'chevron',
            iconRotation: 90,
            onClick: () => {
              if (loading) {
                return;
              }
              setMode('default');
            },
          },
        ]
      : undefined;

  const onClickOK = async () => {
    if (isEmpty(profileName) || !isEmpty(profileNameError)) {
      return;
    }

    setLoading(true);
    await updateDisplayName(profileName);
    setUpdateProfileName(profileName);
    setMode('default');
    setLoading(false);
  };

  const handleProfileHeaderClick = () => {
    if (loading) {
      return;
    }
    closeDialog();
    dispatch(
      updateEditProfilePictureModel({
        avatarPath,
        profileName,
        ourId,
      })
    );
  };

  useKey(
    (event: KeyboardEvent) => {
      return event.key === 'v';
    },
    () => {
      if (loading) {
        return;
      }
      switch (mode) {
        case 'default':
          setMode('qr');
          break;
        case 'qr':
          setMode('default');
          break;
        case 'edit':
        default:
      }
    }
  );

  useKey(
    (event: KeyboardEvent) => {
      return event.key === 'Enter';
    },
    () => {
      if (loading) {
        return;
      }
      switch (mode) {
        case 'default':
          setMode('edit');
          break;
        case 'edit':
          void onClickOK();
          break;
        case 'qr':
        default:
      }
    }
  );

  useKey(
    (event: KeyboardEvent) => {
      return event.key === 'Backspace';
    },
    () => {
      if (loading) {
        return;
      }
      switch (mode) {
        case 'edit':
        case 'qr':
          if (inputRef.current !== null && document.activeElement === inputRef.current) {
            return;
          }
          setMode('default');
          if (mode === 'edit') {
            setProfileNameError(undefined);
            setProfileName(updatedProfileName);
          }
          break;
        case 'default':
        default:
      }
    }
  );

  useKey(
    (event: KeyboardEvent) => {
      return event.key === 'Esc' || event.key === 'Escape';
    },
    () => {
      if (loading) {
        return;
      }
      if (mode === 'edit') {
        setMode('default');
        setProfileNameError(undefined);
        setProfileName(updatedProfileName);
      } else {
        window.inboxStore?.dispatch(editProfileModal(null));
      }
    }
  );

  return (
    <StyledEditProfileDialog className="edit-profile-dialog" data-testid="edit-profile-dialog">
      <SessionWrapperModal
        title={window.i18n('editProfileModalTitle')}
        headerIconButtons={backButton}
        headerReverse={true}
        showExitIcon={true}
        onClose={closeDialog}
        additionalClassName={mode === 'default' ? 'edit-profile-default' : undefined}
      >
        {mode === 'qr' ? (
          <QRView sessionID={ourId} />
        ) : (
          <>
            <SpacerXL />
            <ProfileHeader
              avatarPath={avatarPath}
              profileName={profileName}
              ourId={ourId}
              onClick={handleProfileHeaderClick}
              onQRClick={() => {
                if (loading) {
                  return;
                }
                setMode('qr');
              }}
            />
          </>
        )}

        <SpacerLG />

        {mode === 'default' && (
          <StyledProfileName container={true} justifyContent="center" alignItems="center">
            <SessionIconButton
              iconType="pencil"
              iconSize="large"
              onClick={() => {
                if (loading) {
                  return;
                }
                setMode('edit');
              }}
              dataTestId="edit-profile-icon"
            />
            <SpacerSM />
            <p data-testid="your-profile-name">{updatedProfileName || profileName}</p>
          </StyledProfileName>
        )}

        {mode === 'edit' && (
          <SessionInput
            autoFocus={true}
            disableOnBlurEvent={true}
            type="text"
            placeholder={window.i18n('enterDisplayName')}
            value={profileName}
            onValueChanged={(name: string) => {
              const sanitizedName = sanitizeDisplayNameOrToast(name, setProfileNameError);
              setProfileName(sanitizedName);
            }}
            editable={!loading}
            tabIndex={0}
            required={true}
            error={profileNameError}
            textSize={'xl'}
            centerText={true}
            inputRef={inputRef}
            inputDataTestId="profile-name-input"
          />
        )}

        {mode !== 'qr' ? <Spacer3XL /> : <SpacerSM />}

        <StyledSessionIdSection
          container={true}
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
          width={'100%'}
        >
          <YourSessionIDPill />
          <SpacerLG />
          <YourSessionIDSelectable />
          <SessionSpinner loading={loading} height={'74px'} />
          {!loading ? <Spacer2XL /> : null}
          {mode === 'default' || mode === 'qr' ? (
            <Flex
              container={true}
              justifyContent={mode === 'default' ? 'space-between' : 'center'}
              alignItems="center"
              flexGap="var(--margins-lg)"
              width={'100%'}
            >
              <CopyToClipboardButton
                copyContent={ourId}
                hotkey={true}
                reference={copyButtonRef}
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

          {!loading ? <SpacerSM /> : null}
        </StyledSessionIdSection>
      </SessionWrapperModal>
    </StyledEditProfileDialog>
  );
};
