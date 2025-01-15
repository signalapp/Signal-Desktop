// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React from 'react';

import type { LocalizerType } from '../../types/Util';
import * as Errors from '../../types/errors';
import * as log from '../../logging/log';

export type Props = {
  i18n: LocalizerType;
  children: ReactNode;

  showDebugLog(): void;
};

export type State = {
  error?: Error;
};

const CSS_MODULE = 'module-error-boundary-notification';

export class ErrorBoundary extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = { error: undefined };
  }

  public static getDerivedStateFromError(error: Error): State {
    log.error(
      'ErrorBoundary: captured rendering error',
      Errors.toLogFormat(error)
    );
    return { error };
  }

  public override render(): ReactNode {
    const { error } = this.state;
    const { i18n, children } = this.props;

    if (!error) {
      return children;
    }

    return (
      <div
        className={CSS_MODULE}
        onClick={this.#onClick.bind(this)}
        onKeyDown={this.#onKeyDown.bind(this)}
        role="button"
        tabIndex={0}
      >
        <div className={`${CSS_MODULE}__icon-container`}>
          <div className={`${CSS_MODULE}__icon`} />
        </div>
        <div className={`${CSS_MODULE}__message`}>
          {i18n('icu:ErrorBoundaryNotification__text')}
        </div>
      </div>
    );
  }

  #onClick(event: React.MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();

    this.#onAction();
  }

  #onKeyDown(event: React.KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.stopPropagation();
    event.preventDefault();

    this.#onAction();
  }

  #onAction(): void {
    const { showDebugLog } = this.props;
    showDebugLog();
  }
}
