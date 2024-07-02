import { isEmpty } from 'lodash';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { SettingsKey } from '../../data/settings-key';
import { updateHideRecoveryPasswordModel } from '../../state/ducks/modalDialog';
import { showSettingsSection } from '../../state/ducks/section';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { Flex } from '../basic/Flex';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SessionHtmlRenderer } from '../basic/SessionHTMLRenderer';
import { SpacerMD } from '../basic/Text';

const StyledDescriptionContainer = styled.div`
  width: 280px;
  line-height: 120%;
`;

export type HideRecoveryPasswordDialogProps = {
  state: 'firstWarning' | 'secondWarning';
};

export function HideRecoveryPasswordDialog(props: HideRecoveryPasswordDialogProps) {
  const { state } = props;

  const dispatch = useDispatch();

  const onClose = () => {
    dispatch(updateHideRecoveryPasswordModel(null));
  };

  const onConfirmation = async () => {
    await window.setSettingValue(SettingsKey.hideRecoveryPassword, true);
    onClose();
    dispatch(showSettingsSection('privacy'));
  };

  if (isEmpty(state)) {
    return null;
  }

  const leftButtonProps =
    state === 'firstWarning'
      ? {
          text: window.i18n('continue'),
          buttonColor: SessionButtonColor.Danger,
          onClick: () => {
            dispatch(updateHideRecoveryPasswordModel({ state: 'secondWarning' }));
          },
          dataTestId: 'session-confirm-ok-button',
        }
      : {
          text: window.i18n('cancel'),
          onClick: onClose,
          dataTestId: 'session-confirm-cancel-button',
        };

  const rightButtonProps =
    state === 'firstWarning'
      ? {
          text: window.i18n('cancel'),
          onClick: onClose,
          dataTestId: 'session-confirm-cancel-button',
        }
      : {
          text: window.i18n('yes'),
          buttonColor: SessionButtonColor.Danger,
          onClick: () => {
            void onConfirmation();
          },
          dataTestId: 'session-confirm-ok-button',
        };

  return (
    <SessionWrapperModal
      title={window.i18n('recoveryPasswordHidePermanently')}
      onClose={onClose}
      showExitIcon={false}
      showHeader={true}
      additionalClassName="no-body-padding"
    >
      <StyledDescriptionContainer>
        <SessionHtmlRenderer
          html={
            state === 'firstWarning'
              ? window.i18n('recoveryPasswordHidePermanentlyDescription1')
              : window.i18n('recoveryPasswordHidePermanentlyDescription2')
          }
        />
      </StyledDescriptionContainer>
      <SpacerMD />
      <Flex container={true} justifyContent="center" alignItems="center" width="100%">
        <SessionButton {...leftButtonProps} buttonType={SessionButtonType.Ghost} />
        <SessionButton {...rightButtonProps} buttonType={SessionButtonType.Ghost} />
      </Flex>
    </SessionWrapperModal>
  );
}
