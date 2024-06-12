import { isEmpty } from 'lodash';
import { RefObject, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';

import { Dispatch } from '@reduxjs/toolkit';
import { SyncUtils, UserUtils } from '../../../session/utils';
import { YourSessionIDPill, YourSessionIDSelectable } from '../../basic/YourSessionIDPill';

import { useHotkey } from '../../../hooks/useHotkey';
import { useOurAvatarPath, useOurConversationUsername } from '../../../hooks/useParamSelector';
import { ConversationTypeEnum } from '../../../models/conversationAttributes';
import { getConversationController } from '../../../session/conversations';
import { editProfileModal, updateEditProfilePictureModel } from '../../../state/ducks/modalDialog';
import { setLastProfileUpdateTimestamp } from '../../../util/storage';
import { SessionWrapperModal } from '../../SessionWrapperModal';
import { Flex } from '../../basic/Flex';
import { SessionButton } from '../../basic/SessionButton';
import { Spacer2XL, Spacer3XL, SpacerLG, SpacerSM, SpacerXL } from '../../basic/Text';
import { CopyToClipboardButton } from '../../buttons/CopyToClipboardButton';
import { SessionInput } from '../../inputs';
import { SessionSpinner } from '../../loading';
import { sanitizeDisplayNameOrToast } from '../../registration/utils';
import { ProfileHeader, ProfileName, QRView } from './components';

// #region Shortcuts
const handleKeyQRMode = (
  mode: ProfileDialogModes,
  setMode: (mode: ProfileDialogModes) => void,
  loading: boolean
) => {
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
};

const handleKeyEditMode = (
  mode: ProfileDialogModes,
  setMode: (mode: ProfileDialogModes) => void,
  onClick: () => Promise<void>,
  loading: boolean
) => {
  if (loading) {
    return;
  }
  switch (mode) {
    case 'default':
      setMode('edit');
      break;
    case 'edit':
      void onClick();
      break;
    case 'qr':
    default:
  }
};

const handleKeyCancel = (
  mode: ProfileDialogModes,
  setMode: (mode: ProfileDialogModes) => void,
  inputRef: RefObject<HTMLInputElement>,
  updatedProfileName: string,
  setProfileName: (name: string) => void,
  setProfileNameError: (error: string | undefined) => void,
  loading: boolean
) => {
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
};

const handleKeyEscape = (
  mode: ProfileDialogModes,
  setMode: (mode: ProfileDialogModes) => void,
  updatedProfileName: string,
  setProfileName: (name: string) => void,
  setProfileNameError: (error: string | undefined) => void,
  loading: boolean,
  dispatch: Dispatch
) => {
  if (loading) {
    return;
  }
  if (mode === 'edit') {
    setMode('default');
    setProfileNameError(undefined);
    setProfileName(updatedProfileName);
  } else {
    dispatch(editProfileModal(null));
  }
};

// #endregion

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

const StyledSessionIdSection = styled(Flex)`
  .session-button {
    width: 160px;
  }
`;

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

export type ProfileDialogModes = 'default' | 'edit' | 'qr';

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

  useHotkey('v', () => handleKeyQRMode(mode, setMode, loading), loading);
  useHotkey('Enter', () => handleKeyEditMode(mode, setMode, onClickOK, loading), loading);
  useHotkey(
    'Backspace',
    () =>
      handleKeyCancel(
        mode,
        setMode,
        inputRef,
        updatedProfileName,
        setProfileName,
        setProfileNameError,
        loading
      ),
    loading
  );
  useHotkey(
    'Escape',
    () =>
      handleKeyEscape(
        mode,
        setMode,
        updatedProfileName,
        setProfileName,
        setProfileNameError,
        loading,
        dispatch
      ),
    loading
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
          <ProfileName
            profileName={updatedProfileName || profileName}
            onClick={() => {
              if (loading) {
                return;
              }
              setMode('edit');
            }}
          />
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
                  dataTestId="view-qr-code-button"
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
