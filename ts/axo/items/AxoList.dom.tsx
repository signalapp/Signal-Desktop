// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC, ReactNode } from 'react';
import { memo } from 'react';
import { tw } from '../tw.dom.tsx';
import { AriaLabelled } from '../aria/AriaLabelled.dom.tsx';

export namespace AxoList {
  /**
   * <AxoList.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    accessibilityLabel?: string;
    children: ReactNode;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    return (
      <AriaLabelled.Root asChild label={props.accessibilityLabel}>
        <section>{props.children}</section>
      </AriaLabelled.Root>
    );
  });

  Root.displayName = 'AxoList.Root';

  /**
   * <AxoList.Header>
   * --------------------------------------------------------------------------
   */

  export type HeaderProps = Readonly<{
    children: ReactNode;
  }>;

  export const Header: FC<HeaderProps> = memo(props => {
    return <div className={tw('px-4 py-2')}>{props.children}</div>;
  });

  Header.displayName = 'AxoList.Header';

  /**
   * <AxoList.Title>
   * --------------------------------------------------------------------------
   */

  export type TitleProps = Readonly<{
    children: ReactNode;
  }>;

  export const Title: FC<TitleProps> = memo(props => {
    return (
      <AriaLabelled.Label asChild>
        <h2 className={tw('type-body-medium font-semibold')}>
          {props.children}
        </h2>
      </AriaLabelled.Label>
    );
  });

  Title.displayName = 'AxoList.Title';

  /**
   * <AxoList.Description>
   * --------------------------------------------------------------------------
   */

  export type DescriptionProps = Readonly<{
    children: ReactNode;
  }>;

  export const Description: FC<DescriptionProps> = memo(props => {
    return (
      <AriaLabelled.Description asChild>
        <p className={tw('type-body-small text-secondary')}>{props.children}</p>
      </AriaLabelled.Description>
    );
  });

  Description.displayName = 'AxoList.Description';

  /**
   * <AxoList.Body>
   * --------------------------------------------------------------------------
   */

  export type BodyProps = Readonly<{
    children: ReactNode;
  }>;

  export const Body: FC<BodyProps> = memo(props => {
    return (
      <div
        className={tw(
          'min-w-fit',
          'curved-20 bg-surface-card p-1.5 shadow-elevation-0',
          'forced-colors:bg-[Canvas] forced-colors:text-[CanvasText]',
          'forced-colors:border forced-colors:border-[ButtonBorder]'
        )}
      >
        {props.children}
      </div>
    );
  });

  Body.displayName = 'AxoList.Body';

  /**
   * <AxoList.Footer>
   * --------------------------------------------------------------------------
   */

  export type FooterProps = Readonly<{
    children: ReactNode;
  }>;

  export const Footer: FC<FooterProps> = memo(props => {
    return <div className={tw('px-4 py-2')}>{props.children}</div>;
  });

  Footer.displayName = 'AxoList.Footer';

  /**
   * <AxoList.Help>
   * --------------------------------------------------------------------------
   */

  export type HelpProps = Readonly<{
    children: ReactNode;
  }>;

  export const Help: FC<HelpProps> = memo(props => {
    return (
      <AriaLabelled.Description asChild>
        <p
          className={tw(
            'type-body-small text-secondary',
            'forced-colors:text-[GrayText]'
          )}
        >
          {props.children}
        </p>
      </AriaLabelled.Description>
    );
  });

  Help.displayName = 'AxoList.Help';
}
