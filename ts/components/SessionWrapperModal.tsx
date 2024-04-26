import classNames from 'classnames';
import { ReactNode, useRef } from 'react';
import useKey from 'react-use/lib/useKey';

import { SessionIconButton } from './icon';

import { SessionFocusTrap } from './SessionFocusTrap';
import { Flex } from './basic/Flex';
import { SessionButton, SessionButtonColor, SessionButtonType } from './basic/SessionButton';
import { SpacerXL } from './basic/Text';

export type SessionWrapperModalType = {
  title?: string;
  showHeader?: boolean;
  onConfirm?: () => void;
  onClose?: () => void;
  showClose?: boolean;
  confirmText?: string;
  cancelText?: string;
  showExitIcon?: boolean;
  headerIconButtons?: Array<any>;
  children: ReactNode;
  headerReverse?: boolean;
  additionalClassName?: string;
};

export const SessionWrapperModal = (props: SessionWrapperModalType) => {
  const {
    title,
    onConfirm,
    onClose,
    showHeader = true,
    showClose = false,
    confirmText,
    cancelText,
    showExitIcon,
    headerIconButtons,
    headerReverse,
    additionalClassName,
  } = props;

  useKey(
    'Esc',
    () => {
      props.onClose?.();
    },
    undefined,
    [props.onClose]
  );

  useKey(
    'Escape',
    () => {
      props.onClose?.();
    },
    undefined,
    [props.onClose]
  );

  const modalRef = useRef<HTMLDivElement>(null);

  const handleClick = (e: any) => {
    if (!modalRef.current?.contains(e.target)) {
      props.onClose?.();
    }
  };

  return (
    <SessionFocusTrap>
      <div
        className={classNames('loki-dialog modal', additionalClassName || null)}
        onClick={handleClick}
        role="dialog"
      >
        <div className="session-confirm-wrapper">
          <div ref={modalRef} className="session-modal">
            {showHeader ? (
              <Flex
                container={true}
                flexDirection={headerReverse ? 'row-reverse' : 'row'}
                justifyContent={'space-between'}
                alignItems={'center'}
                padding={'var(--margins-lg)'}
                className={'session-modal__header'}
              >
                <Flex
                  container={true}
                  flexDirection={headerReverse ? 'row-reverse' : 'row'}
                  alignItems={'center'}
                  padding={'0'}
                  margin={'0'}
                  className={'session-modal__header__close'}
                >
                  {showExitIcon ? (
                    <SessionIconButton
                      iconType="exit"
                      iconSize="small"
                      onClick={props.onClose}
                      padding={'5px'}
                      margin={'0'}
                      dataTestId="modal-close-button"
                    />
                  ) : null}
                  {headerIconButtons?.length
                    ? headerIconButtons.map((_, index) => {
                        const offset = showExitIcon
                          ? headerIconButtons.length - 2
                          : headerIconButtons.length - 1;
                        if (index > offset) {
                          return null;
                        }
                        return <SpacerXL key={`session-modal__header_space-${index}`} />;
                      })
                    : null}
                </Flex>
                <div className="session-modal__header__title">{title}</div>
                <Flex
                  container={true}
                  flexDirection={headerReverse ? 'row-reverse' : 'row'}
                  alignItems={'center'}
                  padding={'0'}
                  margin={'0'}
                >
                  {headerIconButtons?.length ? (
                    headerIconButtons.map((iconItem: any) => {
                      return (
                        <SessionIconButton
                          key={iconItem.iconType}
                          iconType={iconItem.iconType}
                          iconSize={'large'}
                          iconRotation={iconItem.iconRotation}
                          onClick={iconItem.onClick}
                          padding={'0'}
                          margin={'0'}
                        />
                      );
                    })
                  ) : showExitIcon ? (
                    <SpacerXL />
                  ) : null}
                </Flex>
              </Flex>
            ) : null}

            <div className="session-modal__body">
              <div className="session-modal__centered">
                {props.children}

                <div className="session-modal__button-group">
                  {onConfirm ? (
                    <SessionButton buttonType={SessionButtonType.Simple} onClick={props.onConfirm}>
                      {confirmText || window.i18n('ok')}
                    </SessionButton>
                  ) : null}
                  {onClose && showClose ? (
                    <SessionButton
                      buttonType={SessionButtonType.Simple}
                      buttonColor={SessionButtonColor.Danger}
                      onClick={props.onClose}
                    >
                      {cancelText || window.i18n('close')}
                    </SessionButton>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SessionFocusTrap>
  );
};
