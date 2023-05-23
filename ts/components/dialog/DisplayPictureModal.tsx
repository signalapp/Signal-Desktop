import React, { useState } from 'react';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SpacerLG } from '../basic/Text';
import { useDispatch } from 'react-redux';
import { updateDisplayPictureModel } from '../../state/ducks/modalDialog';
import { ProfileAvatar, ProfileAvatarProps } from './EditProfileDialog';
import styled from 'styled-components';
import { uploadOurAvatar } from '../../interactions/conversationInteractions';
import { ToastUtils } from '../../session/utils';
import { SessionSpinner } from '../basic/SessionSpinner';

const StyledAvatarContainer = styled.div`
  cursor: pointer;
`;

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

export type DisplayPictureModalProps = ProfileAvatarProps & {
  avatarAction: () => Promise<string | null>;
  removeAction: () => void;
};

export const DisplayPictureModal = (props: DisplayPictureModalProps) => {
  const dispatch = useDispatch();

  if (!props) {
    return null;
  }

  const {
    newAvatarObjectUrl: _newAvatarObjectUrl,
    oldAvatarPath,
    profileName,
    ourId,
    avatarAction,
    removeAction,
  } = props;

  const [newAvatarObjectUrl, setNewAvatarObjectUrl] = useState<string | null>(_newAvatarObjectUrl);
  const [loading, setLoading] = useState(false);

  const closeDialog = () => {
    dispatch(updateDisplayPictureModel(null));
  };

  return (
    <SessionWrapperModal
      title={window.i18n('setDisplayPicture')}
      onClose={closeDialog}
      showHeader={true}
      showExitIcon={true}
    >
      <div
        className="avatar-center"
        onClick={async () => {
          const updatedAvatarObjectUrl = await avatarAction();
          if (updatedAvatarObjectUrl) {
            setNewAvatarObjectUrl(updatedAvatarObjectUrl);
          }
        }}
      >
        <StyledAvatarContainer className="avatar-center-inner">
          <ProfileAvatar
            newAvatarObjectUrl={newAvatarObjectUrl}
            oldAvatarPath={oldAvatarPath}
            profileName={profileName}
            ourId={ourId}
          />
        </StyledAvatarContainer>
      </div>

      <SpacerLG />
      <SessionSpinner loading={loading} />

      <div className="session-modal__button-group">
        <SessionButton
          text={window.i18n('upload')}
          buttonType={SessionButtonType.Simple}
          onClick={async () => {
            setLoading(true);
            if (newAvatarObjectUrl === _newAvatarObjectUrl) {
              window.log.debug(`Avatar Object URL has not changed!`);
              return;
            }

            await uploadProfileAvatar(newAvatarObjectUrl);
            setLoading(false);
            closeDialog();
          }}
          disabled={_newAvatarObjectUrl === newAvatarObjectUrl}
        />
        <SessionButton
          text={window.i18n('remove')}
          buttonColor={SessionButtonColor.Danger}
          buttonType={SessionButtonType.Simple}
          onClick={() => {
            removeAction();
          }}
          disabled={!oldAvatarPath}
        />
      </div>
    </SessionWrapperModal>
  );
};
