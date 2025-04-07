// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import React from 'react';

export type FunPanelProps = Readonly<{
  children: ReactNode;
}>;

export function FunPanel(props: FunPanelProps): JSX.Element {
  return <div className="FunPanel">{props.children}</div>;
}

export type FunPanelHeaderProps = Readonly<{
  children: ReactNode;
}>;

export function FunPanelHeader(props: FunPanelHeaderProps): JSX.Element {
  return <div className="FunPanel__Header">{props.children}</div>;
}

export type FunPanelBodyProps = Readonly<{
  children: ReactNode;
}>;

export function FunPanelBody(props: FunPanelBodyProps): JSX.Element {
  return <div className="FunPanel__Body">{props.children}</div>;
}

export type FunPanelFooterProps = Readonly<{
  children: ReactNode;
}>;

export function FunPanelFooter(props: FunPanelFooterProps): JSX.Element {
  return <div className="FunPanel__Footer">{props.children}</div>;
}
