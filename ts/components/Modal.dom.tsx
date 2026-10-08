// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement, ReactNode, JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import lodash from 'lodash';
import { animated, type SpringValues } from '@react-spring/web';

import { v4 as uuid } from 'uuid';
import type { LocalizerType } from '../types/Util.std.ts';
import { ModalHost } from './ModalHost.dom.tsx';
import type { Theme } from '../util/theme.std.ts';
import { assertDev } from '../util/assert.std.ts';
import {
  type ModalConfigType,
  useAnimated,
} from '../hooks/useAnimated.dom.tsx';
import { useHasWrapped } from '../hooks/useHasWrapped.std.ts';
import { createLogger } from '../logging/log.std.ts';
import {
  isScrollOverflowVertical,
  isScrollAtTop,
  isScrollAtBottom,
  useScrollObserver,
} from '../hooks/useSizeObserver.dom.tsx';

const { noop } = lodash;

const log = createLogger('Modal');

type PropsType = {
  children: ReactNode;
  modalName: string;
  hasXButton?: boolean;
  hasHeaderDivider?: boolean;
  hasFooterDivider?: boolean;
  i18n: LocalizerType;
  modalFooter?: JSX.Element;
  modalHeaderChildren?: ReactNode;

  /** @deprecated */
  className?: string;
  onBackButtonClick?: () => unknown;
  onClose?: () => void;
  title?: ReactNode;
  padded?: boolean;
  ['aria-describedby']?: string;
};

export type ModalPropsType = PropsType & {
  noTransform?: boolean;
  noEscapeClose?: boolean;
  noMouseClose?: boolean;
  theme?: Theme;
};

export function Modal({
  children,
  modalName,
  hasXButton,
  i18n,
  modalFooter,
  modalHeaderChildren,
  className,
  noEscapeClose,
  noMouseClose,
  onBackButtonClick,
  onClose = noop,
  theme,
  title,
  hasHeaderDivider = false,
  hasFooterDivider = false,
  noTransform = false,
  padded = true,
  'aria-describedby': ariaDescribedBy,
}: Readonly<ModalPropsType>): JSX.Element | null {
  const { close, isClosed, modalStyles, overlayStyles } = useAnimated(
    onClose,

    // `background-position: fixed` cannot properly detect the viewport when
    // the parent element has `transform: translate*`. Even though it requires
    // layout recalculation - use `margin-top` if asked by the embedder.
    noTransform
      ? {
          getFrom: () => ({ opacity: 0, marginTop: '48px' }),
          getTo: isOpen =>
            isOpen
              ? { opacity: 1, marginTop: '0px' }
              : { opacity: 0, marginTop: '48px' },
        }
      : {
          getFrom: () => ({ opacity: 0, transform: 'translateY(48px)' }),
          getTo: isOpen =>
            isOpen
              ? { opacity: 1, transform: 'translateY(0px)' }
              : { opacity: 0, transform: 'translateY(48px)' },
        }
  );

  useEffect(() => {
    if (!isClosed) {
      return noop;
    }

    const timer = setTimeout(() => {
      log.error(`${modalName} is closed, but still visible`);
      assertDev(false, `Invisible modal ${modalName}`);
    }, 0);
    return () => {
      clearTimeout(timer);
    };
  }, [modalName, isClosed]);

  if (isClosed) {
    return null;
  }

  return (
    <ModalHost
      modalName={modalName}
      className={className}
      noEscapeClose={noEscapeClose}
      noMouseClose={noMouseClose}
      onClose={close}
      onEscape={onBackButtonClick}
      overlayStyles={overlayStyles}
      theme={theme}
    >
      <ModalPage
        modalName={modalName}
        hasXButton={hasXButton}
        i18n={i18n}
        modalFooter={modalFooter}
        modalHeaderChildren={modalHeaderChildren}
        className={className}
        onBackButtonClick={onBackButtonClick}
        onClose={close}
        title={title}
        padded={padded}
        hasHeaderDivider={hasHeaderDivider}
        hasFooterDivider={hasFooterDivider}
        aria-describedby={ariaDescribedBy}
        modalStyles={modalStyles}
      >
        {children}
      </ModalPage>
    </ModalHost>
  );
}

type ModalPageProps = Readonly<{
  modalStyles?: SpringValues<ModalConfigType>;
  onClose: () => void;
}> &
  Omit<Readonly<PropsType>, 'onClose'>;

/**
 * Represents a single instance (or page) of a modal window.
 *
 * It should not be used by itself, either wrap it with PagedModal,
 * render it in a component that has PagedModal as an ancestor, or
 * use Modal instead.
 *
 * It does not provide open/close animation.
 *
 * NOTE: When used in conjunction with PagedModal (almost always the case):
 * onClose" handler should be the one provided by the parent PagedModal,
 * not one that has any logic. If you have some logic to execute when the
 * modal closes, pass it to PagedModal.
 */
export function ModalPage({
  children,
  hasXButton,
  i18n,
  modalFooter,
  modalHeaderChildren,
  modalName,
  modalStyles,
  className,
  onBackButtonClick,
  onClose,
  title,
  padded = true,
  hasHeaderDivider = false,
  hasFooterDivider = false,
  'aria-describedby': ariaDescribedBy,
}: ModalPageProps): JSX.Element {
  const modalRef = useRef<HTMLDivElement | null>(null);

  const bodyRef = useRef<HTMLDivElement>(null);
  const bodyInnerRef = useRef<HTMLDivElement>(null);

  const [scrollAtTop, setScrollAtTop] = useState(false);
  const [scrollAtBottom, setScrollAtBottom] = useState(false);
  const [scrollVerticalOverflow, setScrollOverflowVertical] = useState(false);

  const hasHeader = Boolean(
    hasXButton || title || modalHeaderChildren || onBackButtonClick
  );

  const [id] = useState(() => uuid());

  useScrollObserver(bodyRef, bodyInnerRef, scroll => {
    setScrollAtTop(isScrollAtTop(scroll));
    setScrollAtBottom(isScrollAtBottom(scroll));
    setScrollOverflowVertical(isScrollOverflowVertical(scroll));
  });

  return (
    <animated.div
      className={classNames(
        'module-Modal',
        hasHeader ? 'module-Modal--has-header' : 'module-Modal--no-header',
        Boolean(modalFooter) && 'module-Modal--has-footer',
        padded && 'module-Modal--padded',
        hasHeaderDivider && 'module-Modal--header-divider',
        hasFooterDivider && 'module-Modal--footer-divider',
        className
      )}
      ref={modalRef}
      role="dialog"
      tabIndex={-1}
      aria-labelledby={title ? `${id}-title` : undefined}
      aria-describedby={ariaDescribedBy}
      data-testid={modalName}
      onClick={event => {
        // We don't want the click event to propagate to its container node.
        event.stopPropagation();
      }}
      style={modalStyles}
    >
      {hasHeader && (
        <div
          className={classNames(
            'module-Modal__header',
            onBackButtonClick ? 'module-Modal__header--with-back-button' : null
          )}
        >
          <div className="module-Modal__headerTitle">
            {onBackButtonClick && (
              <button
                aria-label={i18n('icu:back')}
                className="module-Modal__back-button"
                onClick={onBackButtonClick}
                tabIndex={0}
                type="button"
              />
            )}
            {title && (
              <h1
                id={`${id}-title`}
                className={classNames(
                  'module-Modal__title',
                  hasXButton ? 'module-Modal__title--with-x-button' : null
                )}
              >
                {title}
              </h1>
            )}
            {hasXButton && !title && <div className="module-Modal__title" />}
            {hasXButton && (
              <button
                aria-label={i18n('icu:close')}
                className="module-Modal__close-button"
                onClick={onClose}
                tabIndex={0}
                type="button"
              />
            )}
          </div>
          {modalHeaderChildren}
        </div>
      )}
      <div
        className={classNames(
          'module-Modal__body',
          scrollAtTop ? 'module-Modal__body--scrollAtTop' : null,
          scrollAtBottom ? 'module-Modal__body--scrollAtBottom' : null,
          scrollVerticalOverflow || scrollAtTop
            ? 'module-Modal__body--scrollVerticalOverflow'
            : null
        )}
        ref={bodyRef}
      >
        <div ref={bodyInnerRef} className="module-Modal__body_inner">
          {children}
        </div>
      </div>
      {modalFooter && <Modal.ButtonFooter>{modalFooter}</Modal.ButtonFooter>}
    </animated.div>
  );
}

function ButtonFooter({
  children,
}: Readonly<{
  children: ReactNode;
}>): ReactElement {
  const [ref, hasWrapped] = useHasWrapped<HTMLDivElement>();
  return (
    <div
      className={classNames(
        'module-Modal__button-footer',
        hasWrapped
          ? 'module-Modal__button-footer--one-button-per-line'
          : undefined
      )}
      ref={ref}
    >
      {children}
    </div>
  );
}
Modal.ButtonFooter = ButtonFooter;

type PagedModalProps = Readonly<{
  modalName: string;
  children: RenderModalPage;
  /** @deprecated */
  className?: string;
  onClose?: () => void;
  noMouseClose?: boolean;
  theme?: Theme;
}>;

/**
 * Provides modal animation and click to close functionality to a
 * ModalPage descendant.
 *
 * Useful when we want to swap between different ModalPages (possibly
 * rendered by different components) without triggering an open/close
 * transition animation.
 */
export function PagedModal({
  modalName,
  children,
  className,
  noMouseClose,
  onClose = noop,
  theme,
}: PagedModalProps): JSX.Element | null {
  const { close, isClosed, modalStyles, overlayStyles } = useAnimated(onClose, {
    getFrom: () => ({ opacity: 0, transform: 'translateY(48px)' }),
    getTo: isOpen =>
      isOpen
        ? { opacity: 1, transform: 'translateY(0px)' }
        : { opacity: 0, transform: 'translateY(48px)' },
  });

  useEffect(() => {
    if (!isClosed) {
      return noop;
    }

    const timer = setTimeout(() => {
      log.error(`PagedModal ${modalName} is closed, but still visible`);
      assertDev(false, `Invisible paged modal ${modalName}`);
    }, 0);
    return () => {
      clearTimeout(timer);
    };
  }, [modalName, isClosed]);

  if (isClosed) {
    return null;
  }

  return (
    <ModalHost
      modalName={modalName}
      className={className}
      noMouseClose={noMouseClose}
      onClose={close}
      overlayStyles={overlayStyles}
      theme={theme}
    >
      <animated.div style={modalStyles}>{children(close)}</animated.div>
    </ModalHost>
  );
}

export type RenderModalPage = (onClose: () => void) => JSX.Element;
