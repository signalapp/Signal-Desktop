import { shell } from 'electron';
import React, { Dispatch, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import useKey from 'react-use/lib/useKey';
import styled from 'styled-components';
import { useLastMessage } from '../../hooks/useParamSelector';
import { MessageInteraction } from '../../interactions';
import {
  ConversationInteractionStatus,
  updateConversationInteractionState,
} from '../../interactions/conversationInteractions';
import { updateConfirmModal } from '../../state/ducks/modalDialog';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SessionHtmlRenderer } from '../basic/SessionHTMLRenderer';
import { SessionRadioGroup, SessionRadioItems } from '../basic/SessionRadioGroup';
import { SessionSpinner } from '../basic/SessionSpinner';
import { SpacerLG } from '../basic/Text';
import { SessionIcon, SessionIconSize, SessionIconType } from '../icon';

const StyledSubText = styled(SessionHtmlRenderer)<{ textLength: number }>`
  font-size: var(--font-size-md);
  line-height: 1.5;
  margin-bottom: var(--margins-lg);

  max-width: ${props =>
    props.textLength > 90
      ? '60ch'
      : '33ch'}; // this is ugly, but we want the dialog description to have multiple lines when a short text is displayed
`;

const StyledSubMessageText = styled(SessionHtmlRenderer)`
  // Overrides SASS in this one case
  margin-top: 0;
  margin-bottom: var(--margins - md);
`;

export interface SessionConfirmDialogProps {
  message?: string;
  messageSub?: string;
  title?: string;
  radioOptions?: SessionRadioItems;
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
  hideCancel?: boolean;
  okTheme?: SessionButtonColor;
  closeTheme?: SessionButtonColor;
  sessionIcon?: SessionIconType;
  iconSize?: SessionIconSize;
  shouldShowConfirm?: boolean | undefined;
  showExitIcon?: boolean | undefined;
  headerReverse?: boolean;
  conversationId?: string;
}

export const SessionConfirm = (props: SessionConfirmDialogProps) => {
  const dispatch = useDispatch();
  const {
    title = '',
    message = '',
    messageSub = '',
    radioOptions,
    okTheme,
    closeTheme = SessionButtonColor.Danger,
    onClickOk,
    onClickClose,
    hideCancel = false,
    sessionIcon,
    iconSize,
    shouldShowConfirm,
    onClickCancel,
    showExitIcon,
    headerReverse,
    closeAfterInput = true,
    conversationId,
  } = props;

  const lastMessage = useLastMessage(conversationId);

  const [isLoading, setIsLoading] = useState(false);
  const [chosenOption, setChosenOption] = useState(
    radioOptions?.length ? radioOptions[0].value : ''
  );

  const okText = props.okText || window.i18n('ok');
  const cancelText = props.cancelText || window.i18n('cancel');
  const showHeader = !!props.title;

  const onClickOkHandler = async () => {
    if (onClickOk) {
      setIsLoading(true);
      try {
        await onClickOk(chosenOption !== '' ? chosenOption : undefined);
      } catch (e) {
        window.log.warn(e);
      } finally {
        setIsLoading(false);
      }
    }

    if (closeAfterInput) {
      dispatch(updateConfirmModal(null));
    }
  };

  useKey('Enter', () => {
    void onClickOkHandler();
  });

  useKey('Escape', () => {
    onClickCancelHandler();
  });

  useEffect(() => {
    if (isLoading) {
      if (conversationId && lastMessage?.interactionType) {
        void updateConversationInteractionState({
          conversationId,
          type: lastMessage?.interactionType,
          status: ConversationInteractionStatus.Loading,
        });
      }
    }
  }, [isLoading, conversationId, lastMessage?.interactionType]);

  if (shouldShowConfirm && !shouldShowConfirm) {
    return null;
  }

  /**
   * Performs specified on close action then removes the modal.
   */
  const onClickCancelHandler = () => {
    onClickCancel?.();
    onClickClose?.();
    window.inboxStore?.dispatch(updateConfirmModal(null));
  };

  return (
    <SessionWrapperModal
      title={title}
      onClose={onClickClose}
      showExitIcon={showExitIcon}
      showHeader={showHeader}
      headerReverse={headerReverse}
    >
      {!showHeader && <SpacerLG />}

      <div className="session-modal__centered">
        {sessionIcon && iconSize && (
          <>
            <SessionIcon iconType={sessionIcon} iconSize={iconSize} />
            <SpacerLG />
          </>
        )}

        <StyledSubText tag="span" textLength={message.length} html={message} />
        {messageSub && (
          <StyledSubMessageText
            tag="span"
            className="session-confirm-sub-message"
            html={messageSub}
          />
        )}

        {radioOptions && chosenOption !== '' ? (
          <SessionRadioGroup
            group="session-confirm-radio-group"
            initialItem={chosenOption}
            items={radioOptions}
            radioPosition="right"
            onClick={value => {
              if (value) {
                setChosenOption(value);
              }
            }}
          />
        ) : null}

        <SessionSpinner loading={isLoading} />
      </div>

      <div className="session-modal__button-group">
        <SessionButton
          text={okText}
          buttonColor={okTheme}
          buttonType={SessionButtonType.Simple}
          onClick={onClickOkHandler}
          dataTestId="session-confirm-ok-button"
        />
        {!hideCancel && (
          <SessionButton
            text={cancelText}
            buttonColor={!okTheme ? closeTheme : undefined}
            buttonType={SessionButtonType.Simple}
            onClick={onClickCancelHandler}
            dataTestId="session-confirm-cancel-button"
          />
        )}
      </div>
    </SessionWrapperModal>
  );
};

export const showLinkVisitWarningDialog = (urlToOpen: string, dispatch: Dispatch<any>) => {
  function onClickOk() {
    void shell.openExternal(urlToOpen);
  }

  dispatch(
    updateConfirmModal({
      title: window.i18n('linkVisitWarningTitle'),
      message: window.i18n('linkVisitWarningMessage', [urlToOpen]),
      okText: window.i18n('open'),
      okTheme: SessionButtonColor.Primary,
      cancelText: window.i18n('editMenuCopy'),
      showExitIcon: true,
      onClickOk,
      onClickClose: () => {
        dispatch(updateConfirmModal(null));
      },
      onClickCancel: () => {
        MessageInteraction.copyBodyToClipboard(urlToOpen);
      },
    })
  );
};
