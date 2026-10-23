// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC, ReactNode, Ref } from 'react';
import { memo } from 'react';
import { css } from '../_internal/css.dom.tsx';
import { forwardExtraPropsForRadix } from '../_internal/props.dom.tsx';

/**
 * @example Anatomy
 * ```tsx
 * <AxoChatList.Root>
 *   <AxoChatItem.Root /> or <AxoChatItemCompact.Root />
 *   <AxoChatList.Group>
 *     <AxoChatList.Label />
 *     <AriaList.Group>
 *       <AxoChatItem.Root /> or <AxoChatItemCompact.Root />
 *     </AriaList.Group>
 *   </AxoChatList.Group>
 * </AxoChatList.Root>
 * ```
 */
export namespace AxoChatList {
  /**
   * <AxoChatList.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    ref?: Ref<HTMLDivElement>;
    compact?: boolean;
    children: ReactNode;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    const { ref, compact, children, ...rest } = props;
    return (
      <div
        ref={ref}
        className={css('axo-chat-list', compact && 'axo-chat-list-compact')}
        {...forwardExtraPropsForRadix(rest)}
      >
        {children}
      </div>
    );
  });

  Root.displayName = 'AxoChatList.Root';

  /**
   * <AxoChatList.Group>
   * --------------------------------------------------------------------------
   */

  export type GroupProps = Readonly<{
    ref?: Ref<HTMLDivElement>;
    children: ReactNode;
  }>;

  export const Group: FC<GroupProps> = memo(props => {
    const { ref, children, ...rest } = props;
    return (
      <div
        ref={ref}
        className="axo-chat-list-group"
        {...forwardExtraPropsForRadix(rest)}
      >
        {children}
      </div>
    );
  });

  Group.displayName = 'AxoChatList.Group';

  /**
   * <AxoChatList.Label>
   * --------------------------------------------------------------------------
   */

  export type LabelProps = Readonly<{
    ref?: Ref<HTMLDivElement>;
    children: ReactNode;
  }>;

  export const Label: FC<LabelProps> = memo(props => {
    const { ref, children, ...rest } = props;
    return (
      <div
        ref={ref}
        className="axo-chat-list-label"
        {...forwardExtraPropsForRadix(rest)}
      >
        <span className="axo-chat-list-label-text">{children}</span>
      </div>
    );
  });

  Label.displayName = 'AxoChatList.Label';

  /**
   * <AxoChatList.EmptyState>
   * --------------------------------------------------------------------------
   */

  export type EmptyStateProps = Readonly<{
    children: ReactNode;
  }>;

  export const EmptyState: FC<EmptyStateProps> = memo(props => {
    const { children } = props;
    return <div className="axo-chat-list-empty-state">{children}</div>;
  });

  EmptyState.displayName = 'AxoChatList.EmptyState';

  /**
   * <AxoChatList.LoadingState>
   * --------------------------------------------------------------------------
   */

  export type LoadingStateProps = Readonly<{
    children: ReactNode;
  }>;

  export const LoadingState: FC<LoadingStateProps> = memo(props => {
    const { children } = props;
    return <div className="axo-chat-list-loading-state">{children}</div>;
  });

  LoadingState.displayName = 'AxoChatList.LoadingState';
}
