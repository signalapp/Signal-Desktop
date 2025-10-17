// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode, ErrorInfo } from 'react';
import React, { Component, useCallback } from 'react';
import { createLogger } from '../logging/log.std.js';
import * as Errors from '../types/errors.std.js';

const log = createLogger('DonationsErrorBoundary');

type ErrorBoundaryProps = Readonly<{
  children: ReactNode;
  onError: (error: unknown, info: ErrorInfo) => void;
  fallback: (error: unknown) => ReactNode;
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

export type DonationsErrorBoundaryProps = Readonly<{
  children: ReactNode;
}>;

export function DonationsErrorBoundary(
  props: DonationsErrorBoundaryProps
): JSX.Element {
  const fallback = useCallback(() => {
    return <div className="DonationsErrorBoundary" />;
  }, []);

  const handleError = useCallback((error: unknown, info: ErrorInfo) => {
    log.error(
      'DonationsErrorBoundary: Caught error',
      Errors.toLogFormat(error),
      info.componentStack
    );

    if (window.reduxActions) {
      window.reduxActions.globalModals.showDebugLogErrorModal({
        description: window.SignalContext.i18n(
          'icu:DonationsErrorBoundary__DonationUnexpectedError'
        ),
      });
    }
  }, []);

  return (
    <ErrorBoundary fallback={fallback} onError={handleError}>
      {props.children}
    </ErrorBoundary>
  );
}
