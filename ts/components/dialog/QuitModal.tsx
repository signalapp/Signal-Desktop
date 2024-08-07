import { useState } from 'react';
import { useDispatch } from 'react-redux';
import useKey from 'react-use/lib/useKey';
import styled from 'styled-components';
import { updateQuitModal } from '../../state/onboarding/ducks/modals';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { Flex } from '../basic/Flex';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SpacerLG, SpacerSM } from '../basic/Text';

const StyledMessage = styled.span`
  max-width: 300px;
  width: 100%;
  line-height: 1.4;
`;

type QuitModalProps = {
  message?: string;
  title?: string;
  onOk?: any;
  onClose?: any;
  closeAfterInput?: boolean;

  /**
   * function to run on ok click. Closes modal after execution by default
   * sometimes the callback might need arguments when using radioOptions
   */
  onClickOk?: (...args: Array<any>) => Promise<void> | void;

  onClickClose?: () => any;

  /**
   * function to run on close click. Closes modal after execution by default
   */
  onClickCancel?: () => any;

  okText?: string;
  cancelText?: string;
  okTheme?: SessionButtonColor;
  closeTheme?: SessionButtonColor;
};

export const QuitModal = (props: QuitModalProps) => {
  const dispatch = useDispatch();
  const {
    title = '',
    message = '',
    okTheme,
    closeTheme = SessionButtonColor.Danger,
    onClickOk,
    onClickClose,
    onClickCancel,
    closeAfterInput = true,
  } = props;

  const [isLoading, setIsLoading] = useState(false);

  const okText = props.okText || window.i18n('ok');
  const cancelText = props.cancelText || window.i18n('cancel');

  const onClickOkHandler = async () => {
    if (onClickOk) {
      setIsLoading(true);
      try {
        await onClickOk();
      } catch (e) {
        window.log.warn(e);
      } finally {
        setIsLoading(false);
      }
    }

    if (closeAfterInput) {
      dispatch(updateQuitModal(null));
    }
  };

  /**
   * Performs specified on close action then removes the modal.
   */
  const onClickCancelHandler = () => {
    onClickCancel?.();
    onClickClose?.();
    dispatch(updateQuitModal(null));
  };

  useKey('Enter', () => {
    void onClickOkHandler();
  });

  useKey('Escape', () => {
    onClickCancelHandler();
  });

  return (
    <SessionWrapperModal
      title={title}
      onClose={onClickClose}
      showExitIcon={false}
      showHeader={true}
      additionalClassName={'no-body-padding'}
    >
      <Flex container={true} width={'100%'} justifyContent="center" alignItems="center">
        <SpacerLG />
        <StyledMessage>{message}</StyledMessage>
        <SpacerLG />
      </Flex>
      <SpacerSM />
      <Flex container={true} width={'100%'} justifyContent="center" alignItems="center">
        <SessionButton
          text={okText}
          buttonColor={okTheme}
          buttonType={SessionButtonType.Ghost}
          onClick={onClickOkHandler}
          disabled={isLoading}
          dataTestId="session-confirm-ok-button"
        />
        <SessionButton
          text={cancelText}
          buttonColor={!okTheme ? closeTheme : undefined}
          buttonType={SessionButtonType.Ghost}
          onClick={onClickCancelHandler}
          disabled={isLoading}
          dataTestId="session-confirm-cancel-button"
        />
      </Flex>
    </SessionWrapperModal>
  );
};
