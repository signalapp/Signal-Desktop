import React, { useEffect, useState } from 'react';
import { SessionHtmlRenderer } from '../basic/SessionHTMLRenderer';
import { updateConfirmModal, updateConfirmModalStatus } from '../../state/ducks/modalDialog';
import { SpacerLG } from '../basic/Text';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SessionSpinner } from '../basic/SessionSpinner';
import { SessionIcon, SessionIconSize, SessionIconType } from '../icon';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { Dispatch } from '@reduxjs/toolkit';
import { shell } from 'electron';
import { MessageInteraction } from '../../interactions';
import {
  ConversationInteractionStatus,
  ConversationInteractionType,
} from '../../interactions/conversationInteractions';

// NOTE could be other confirmation statuses and types in future
export type ConfirmationStatus = ConversationInteractionStatus | undefined;
export type ConfirmationType = ConversationInteractionType | undefined;

export interface SessionConfirmDialogProps {
  message?: string;
  messageSub?: string;
  title?: string;
  onOk?: any;
  onClose?: any;
  closeAfterInput?: boolean;

  /**
   * function to run on ok click. Closes modal after execution by default
   */
  onClickOk?: () => Promise<void> | void;

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
  status?: ConfirmationStatus;
  confirmationType?: ConfirmationType;
  conversationId?: string;
}

export const SessionConfirm = (props: SessionConfirmDialogProps) => {
  const {
    title = '',
    message = '',
    messageSub = '',
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
    closeAfterInput = true,
  } = props;

  const [isLoading, setIsLoading] = useState(false);

  const okText = props.okText || window.i18n('ok');
  const cancelText = props.cancelText || window.i18n('cancel');
  const showHeader = !!props.title;

  const messageSubText = messageSub ? 'session-confirm-main-message' : undefined;

  const onClickOkHandler = async () => {
    if (onClickOk) {
      setIsLoading(true);
      try {
        await onClickOk();
      } catch (e) {
        window.log.warn(e);
        window.inboxStore?.dispatch(updateConfirmModalStatus(ConversationInteractionStatus.Error));
      } finally {
        setIsLoading(false);
        window.inboxStore?.dispatch(
          updateConfirmModalStatus(ConversationInteractionStatus.Success)
        );
      }
    }

    if (closeAfterInput) {
      window.inboxStore?.dispatch(updateConfirmModal(null));
    }
  };

  if (shouldShowConfirm && !shouldShowConfirm) {
    return null;
  }

  /**
   * Performs specified on close action then removes the modal.
   */
  const onClickCancelHandler = () => {
    if (onClickCancel) {
      onClickCancel();
    }

    if (onClickClose) {
      onClickClose();
    }

    // We clear and close the modal but maintain the confirmation status
    window.inboxStore?.dispatch(updateConfirmModal({ status: props.status }));
  };

  useEffect(() => {
    if (isLoading) {
      window.inboxStore?.dispatch(updateConfirmModalStatus(ConversationInteractionStatus.Loading));
    }
  }, [isLoading]);

  useEffect(() => {
    window.log.debug(
      `WIP: SessionConfirm updating status for ${props.conversationId} to ${props.confirmationType} ${props.status}`
    );
  }, [props.conversationId, props.confirmationType, props.status]);

  return (
    <SessionWrapperModal
      title={title}
      onClose={onClickClose}
      showExitIcon={showExitIcon}
      showHeader={showHeader}
    >
      {!showHeader && <SpacerLG />}

      <div className="session-modal__centered">
        {sessionIcon && iconSize && (
          <>
            <SessionIcon iconType={sessionIcon} iconSize={iconSize} />
            <SpacerLG />
          </>
        )}

        <SessionHtmlRenderer tag="span" className={messageSubText} html={message} />
        <SessionHtmlRenderer tag="span" className="session-confirm-sub-message" html={messageSub} />

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
