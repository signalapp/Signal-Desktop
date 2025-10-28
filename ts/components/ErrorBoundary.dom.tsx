// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode, ErrorInfo } from 'react';
import React from 'react';

import * as Errors from '../types/errors.std.js';
import { createLogger } from '../logging/log.std.js';
import { ToastType } from '../types/Toast.dom.js';

const log = createLogger('ErrorBoundary');

export type Props = {
  children: ReactNode;
  name: string;
  closeView?: () => unknown;
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
    return { error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { closeView, name } = this.props;

    log.error(
      `${name}: ` +
        `captured rendering error ${Errors.toLogFormat(error)}` +
        `\nerrorInfo: ${errorInfo.componentStack}`
    );
    if (window.reduxActions) {
      window.reduxActions.toast.showToast({ toastType: ToastType.Error });
    }
    if (closeView) {
      closeView();
    }
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
