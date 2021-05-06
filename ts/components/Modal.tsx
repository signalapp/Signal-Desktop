// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, ReactElement, ReactNode } from 'react';
import classNames from 'classnames';
import { noop } from 'lodash';

import { LocalizerType } from '../types/Util';
import { ModalHost } from './ModalHost';
import { Theme } from '../util/theme';

type PropsType = {
  children: ReactNode;
  hasXButton?: boolean;
  i18n: LocalizerType;
  moduleClassName?: string;
  onClose?: () => void;
  title?: ReactNode;
  theme?: Theme;
};

export function Modal({
  children,
  hasXButton,
  i18n,
  moduleClassName,
  onClose = noop,
  title,
  theme,
}: Readonly<PropsType>): ReactElement {
  const [scrolled, setScrolled] = useState(false);

  const hasHeader = Boolean(hasXButton || title);

  return (
    <ModalHost onClose={onClose} theme={theme}>
      <div
        className={classNames(
          'module-Modal',
          hasHeader ? 'module-Modal--has-header' : 'module-Modal--no-header',
          moduleClassName
        )}
      >
        {hasHeader && (
          <div className="module-Modal__header">
            {hasXButton && (
              <button
                aria-label={i18n('close')}
                type="button"
                className="module-Modal__close-button"
                tabIndex={0}
                onClick={() => {
                  onClose();
                }}
              />
            )}
            {title && (
              <h1
                className={classNames(
                  'module-Modal__title',
                  hasXButton ? 'module-Modal__title--with-x-button' : null
                )}
              >
                {title}
              </h1>
            )}
          </div>
        )}
        <div
          className={classNames('module-Modal__body', {
            'module-Modal__body--scrolled': scrolled,
          })}
          onScroll={event => {
            setScrolled((event.target as HTMLDivElement).scrollTop > 2);
          }}
        >
          {children}
        </div>
      </div>
    </ModalHost>
  );
}

Modal.Footer = ({
  children,
}: Readonly<{ children: ReactNode }>): ReactElement => (
  <div className="module-Modal__footer">{children}</div>
);
