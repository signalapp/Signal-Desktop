import React, { ReactElement } from 'react';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { Avatar, AvatarSize } from '../avatar/Avatar';
import { SpacerLG } from '../basic/Text';
import { UserUtils } from '../../session/utils';
import { useDispatch } from 'react-redux';
import { updateDisplayPictureModel } from '../../state/ducks/modalDialog';

type Props = {};

export const DisplayPictureModal = (props: Props): ReactElement => {
  const {} = props;
  const dispatch = useDispatch();

  const onClickClose = () => {
    dispatch(updateDisplayPictureModel(null));
  };

  return (
    <SessionWrapperModal
      title={window.i18n('setDisplayPicture')}
      onClose={onClickClose}
      showHeader={true}
      showExitIcon={true}
    >
      <div className="avatar-center">
        <div className="avatar-center-inner">
          <Avatar size={AvatarSize.XL} pubkey={UserUtils.getOurPubKeyStrFromCache()} />
        </div>
      </div>

      <SpacerLG />

      <div className="session-modal__button-group">
        <SessionButton
          text={window.i18n('upload')}
          buttonType={SessionButtonType.Simple}
          onClick={() => {}}
        />
        <SessionButton
          text={window.i18n('remove')}
          buttonColor={SessionButtonColor.Danger}
          buttonType={SessionButtonType.Simple}
          onClick={() => {}}
        />
      </div>
    </SessionWrapperModal>
  );
};
