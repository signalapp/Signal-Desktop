// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, ReactElement, ReactNode } from 'react';
import classNames from 'classnames';
import { noop } from 'lodash';

import { LocalizerType } from '../types/Util';
import { ModalHost } from './ModalHost';

type PropsType = {
  children: ReactNode;
  hasXButton?: boolean;
  i18n: LocalizerType;
  onClose?: () => void;
  title?: ReactNode;
};

export function Modal({
  children,
  hasXButton,
  i18n,
  onClose = noop,
  title,
}: Readonly<PropsType>): ReactElement {
  const [scrolled, setScrolled] = useState(false);

  const hasHeader = Boolean(hasXButton || title);

  return (
    <ModalHost onClose={onClose}>
      <div
        className={classNames(
          'module-Modal',
          hasHeader ? 'module-Modal--has-header' : 'module-Modal--no-header'
        )}
      >
        {hasHeader && (
          <div className="module-Modal__header">
            {hasXButton && (
              <button
                aria-label={i18n('close')}
                type="button"
                className="module-Modal__close-button"
                onClick={() => {
                  onClose();
                }}
              />
            )}
            {title && <h1 className="module-Modal__title">{title}</h1>}
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
