// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import React from 'react';
import { Button, Header } from 'react-aria-components';
import { SpinnerV2 } from '../../SpinnerV2';

export type FunResultsProps = Readonly<{
  'aria-busy': boolean;
  children: ReactNode;
}>;

export function FunResults(props: FunResultsProps): JSX.Element {
  return (
    <div role="region" className="FunResults" aria-live="polite">
      {props.children}
    </div>
  );
}

export type FunResultsFigureProps = Readonly<{
  children: ReactNode;
}>;

export function FunResultsFigure(props: FunResultsFigureProps): JSX.Element {
  return (
    <div role="presentation" className="FunResults__Figure">
      {props.children}
    </div>
  );
}

export type FunResultsHeaderProps = Readonly<{
  children: ReactNode;
}>;

export function FunResultsHeader(props: FunResultsHeaderProps): JSX.Element {
  return <Header className="FunResults__Header">{props.children}</Header>;
}

export type FunResultsButtonProps = Readonly<{
  onPress: () => void;
  children: ReactNode;
}>;

export function FunResultsButton(props: FunResultsButtonProps): JSX.Element {
  return (
    <Button className="FunResults__Button" onPress={props.onPress}>
      {props.children}
    </Button>
  );
}

export function FunResultsSpinner(): JSX.Element {
  return (
    <SpinnerV2 className="FunResults__Spinner" size={36} strokeWidth={4} />
  );
}
