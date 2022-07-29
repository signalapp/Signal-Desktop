// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React from 'react';

import * as Errors from '../types/errors';
import * as log from '../logging/log';
import { ToastType } from '../state/ducks/toast';

export type Props = {
  children: ReactNode;
};

export type State = {
  error?: Error;
};

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
    if (window.reduxActions) {
      window.reduxActions.toast.showToast(ToastType.Error);
    }
    return { error };
  }

  public override render(): ReactNode {
    const { error } = this.state;
    const { children } = this.props;

    if (error) {
      return null;
    }

    return children;
  }
}
