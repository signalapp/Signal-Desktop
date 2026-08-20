// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC, ReactNode } from 'react';
import { memo, useId } from 'react';
import { tw } from '../tw.dom.tsx';
import {
  AriaLabellingProvider,
  useAriaLabellingContext,
  useCreateAriaLabellingContext,
} from '../_internal/AriaLabellingContext.dom.tsx';

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
    const { context, labelId } = useCreateAriaLabellingContext();
    return (
      <AriaLabellingProvider value={context}>
        <section
          aria-label={props.accessibilityLabel}
          aria-labelledby={labelId}
        >
          {props.children}
        </section>
      </AriaLabellingProvider>
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
    const id = useId();
    const { labelRef } = useAriaLabellingContext('AxoList.Root');
    return (
      <h2
        ref={labelRef}
        id={id}
        className={tw('type-body-medium font-semibold')}
      >
        {props.children}
      </h2>
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
    const id = useId();
    const { descriptionRef } = useAriaLabellingContext('AxoList.Root');
    return (
      <p
        ref={descriptionRef}
        id={id}
        className={tw('type-body-small text-secondary')}
      >
        {props.children}
      </p>
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
      <p
        className={tw(
          'type-body-small text-secondary',
          'forced-colors:text-[GrayText]'
        )}
      >
        {props.children}
      </p>
    );
  });

  Help.displayName = 'AxoList.Help';
}
