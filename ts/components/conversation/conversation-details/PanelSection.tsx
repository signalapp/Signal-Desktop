// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';
import { bemGenerator } from './util.std.js';

export type Props = {
  actions?: React.ReactNode;
  children?: React.ReactNode;
  borderless?: boolean;
  centerTitle?: boolean;
  title?: string;
};

const bem = bemGenerator('ConversationDetails-panel-section');
const borderlessClass = bem('root', 'borderless');

export function PanelSection({
  actions,
  borderless,
  centerTitle,
  children,
  title,
}: Props): JSX.Element {
  return (
    <div
      className={classNames(bem('root'), borderless ? borderlessClass : null)}
    >
      {(title || actions) && (
        <div className={bem('header', { center: centerTitle || false })}>
          {title && <div className={bem('title')}>{title}</div>}
          {actions && <div>{actions}</div>}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}
