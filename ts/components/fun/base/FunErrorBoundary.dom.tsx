// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode, ErrorInfo } from 'react';
import React, { Component, useCallback } from 'react';
import { createLogger } from '../../../logging/log.std.js';
import * as Errors from '../../../types/errors.std.js';
import { ToastType } from '../../../types/Toast.dom.js';
import { isProduction } from '../../../util/version.std.js';

const log = createLogger('FunErrorBoundary');

type ErrorBoundaryProps = Readonly<{
  onError: (error: unknown, info: ErrorInfo) => void;
  fallback: (error: unknown) => ReactNode;
  children: ReactNode;
}>;

type ErrorBoundaryState = {
  caught?: { error: unknown };
};

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // eslint-disable-next-line react/state-in-constructor
  override state: ErrorBoundaryState = {};

  static getDerivedStateFromError(error: unknown) {
    return { caught: { error } };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    this.props.onError(error, info);
  }

  override render() {
    if (this.state.caught != null) {
      return this.props.fallback(this.state.caught.error);
    }

    return this.props.children;
  }
}

export type FunErrorBoundaryProps = Readonly<{
  children: ReactNode;
}>;

export function FunErrorBoundary(props: FunErrorBoundaryProps): JSX.Element {
  const fallback = useCallback(() => {
    return <div className="FunErrorBoundary" />;
  }, []);

  const handleError = useCallback((error: unknown, info: ErrorInfo) => {
    log.error(
      'ErrorBoundary: Caught error',
      Errors.toLogFormat(error),
      info.componentStack
    );

    if (!isProduction(window.getVersion())) {
      window.reduxActions?.toast.showToast({ toastType: ToastType.Error });
    }
  }, []);

  return (
    <ErrorBoundary fallback={fallback} onError={handleError}>
      {props.children}
    </ErrorBoundary>
  );
}
