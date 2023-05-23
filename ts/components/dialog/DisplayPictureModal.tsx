import React, { useState } from 'react';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SpacerLG } from '../basic/Text';
import { useDispatch } from 'react-redux';
import { editProfileModal, updateDisplayPictureModel } from '../../state/ducks/modalDialog';
import { ProfileAvatar } from './EditProfileDialog';
import styled from 'styled-components';
import { clearOurAvatar, uploadOurAvatar } from '../../interactions/conversationInteractions';
import { ToastUtils } from '../../session/utils';
import { SessionSpinner } from '../basic/SessionSpinner';
import { SessionIconButton } from '../icon';
import { pickFileForAvatar } from '../../types/attachments/VisualAttachment';

const StyledAvatarContainer = styled.div`
  cursor: pointer;
`;

const UploadImageButton = () => {
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ borderRadius: '50%', overflow: 'hidden' }}>
        <SessionIconButton
          iconType="thumbnail"
          iconSize="max"
          iconPadding="16px"
          backgroundColor="var(--chat-buttons-background-color)"
        />
      </div>
      <SessionIconButton
        iconType="plusFat"
        iconSize="medium"
        iconColor="var(--modal-background-content-color)"
        iconPadding="4.5px"
        borderRadius="50%"
        backgroundColor="var(--primary-color)"
        style={{ position: 'absolute', bottom: 0, right: 0 }}
      />
    </div>
  );
};

const uploadProfileAvatar = async (scaledAvatarUrl: string | null) => {
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
  }
};

export type DisplayPictureModalProps = {
  avatarPath: string | null;
  profileName: string | undefined;
  ourId: string;
};

export const DisplayPictureModal = (props: DisplayPictureModalProps) => {
  const dispatch = useDispatch();

  if (!props) {
    return null;
  }

  const { avatarPath, profileName, ourId } = props;

  const [newAvatarObjectUrl, setNewAvatarObjectUrl] = useState<string | null>(avatarPath);
  const [loading, setLoading] = useState(false);

  const closeDialog = () => {
    dispatch(updateDisplayPictureModel(null));
    dispatch(editProfileModal({}));
  };

  const handleAvatarClick = async () => {
    const updatedAvatarObjectUrl = await pickFileForAvatar();
    if (updatedAvatarObjectUrl) {
      setNewAvatarObjectUrl(updatedAvatarObjectUrl);
    }
  };

  const handleUpload = async () => {
    setLoading(true);
    if (newAvatarObjectUrl === avatarPath) {
      window.log.debug(`Avatar Object URL has not changed!`);
      return;
    }

    await uploadProfileAvatar(newAvatarObjectUrl);
    setLoading(false);
    dispatch(updateDisplayPictureModel(null));
  };

  const handleRemove = async () => {
    setLoading(true);
    await clearOurAvatar();
    setNewAvatarObjectUrl(null);
    setLoading(false);
    dispatch(updateDisplayPictureModel(null));
  };

  return (
    <SessionWrapperModal
      title={window.i18n('setDisplayPicture')}
      onClose={closeDialog}
      showHeader={true}
      showExitIcon={true}
    >
      <div className="avatar-center" onClick={handleAvatarClick}>
        <StyledAvatarContainer className="avatar-center-inner">
          {newAvatarObjectUrl || avatarPath ? (
            <ProfileAvatar
              newAvatarObjectUrl={newAvatarObjectUrl}
              avatarPath={avatarPath}
              profileName={profileName}
              ourId={ourId}
            />
          ) : (
            <UploadImageButton />
          )}
        </StyledAvatarContainer>
      </div>

      {loading ? (
        <SessionSpinner loading={loading} />
      ) : (
        <>
          <SpacerLG />
          <div className="session-modal__button-group">
            <SessionButton
              text={window.i18n('save')}
              buttonType={SessionButtonType.Simple}
              onClick={handleUpload}
              disabled={newAvatarObjectUrl === avatarPath}
            />
            <SessionButton
              text={window.i18n('remove')}
              buttonColor={SessionButtonColor.Danger}
              buttonType={SessionButtonType.Simple}
              onClick={handleRemove}
              disabled={!avatarPath}
            />
          </div>
        </>
      )}
    </SessionWrapperModal>
  );
};
