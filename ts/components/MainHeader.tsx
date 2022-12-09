// Copyright 2018-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Manager, Popper, Reference } from 'react-popper';
import { createPortal } from 'react-dom';

import { showSettings } from '../shims/Whisper';
import { Avatar, AvatarSize } from './Avatar';
import { AvatarPopup } from './AvatarPopup';
import type { LocalizerType, ThemeType } from '../types/Util';
import type { AvatarColorType } from '../types/Colors';
import type { BadgeType } from '../badges/types';
import { handleOutsideClick } from '../util/handleOutsideClick';

export type PropsType = {
  areStoriesEnabled: boolean;
  avatarPath?: string;
  badge?: BadgeType;
  color?: AvatarColorType;
  hasPendingUpdate: boolean;
  i18n: LocalizerType;
  isMe?: boolean;
  isVerified?: boolean;
  name?: string;
  phoneNumber?: string;
  profileName?: string;
  theme: ThemeType;
  title: string;
  unreadStoriesCount: number;

  showArchivedConversations: () => void;
  startComposing: () => void;
  startUpdate: () => unknown;
  toggleProfileEditor: () => void;
  toggleStoriesView: () => unknown;
};

type StateType = {
  showingAvatarPopup: boolean;
  popperRoot: HTMLDivElement | null;
  outsideClickDestructor?: () => void;
};

export class MainHeader extends React.Component<PropsType, StateType> {
  public containerRef: React.RefObject<HTMLDivElement> = React.createRef();

  constructor(props: PropsType) {
    super(props);

    this.state = {
      showingAvatarPopup: false,
      popperRoot: null,
    };
  }

  public showAvatarPopup = (): void => {
    const popperRoot = document.createElement('div');
    document.body.appendChild(popperRoot);

    const outsideClickDestructor = handleOutsideClick(
      () => {
        const { showingAvatarPopup } = this.state;
        if (!showingAvatarPopup) {
          return false;
        }

        this.hideAvatarPopup();

        return true;
      },
      {
        containerElements: [popperRoot, this.containerRef],
        name: 'MainHeader.showAvatarPopup',
      }
    );

    this.setState({
      showingAvatarPopup: true,
      popperRoot,
      outsideClickDestructor,
    });
  };

  public hideAvatarPopup = (): void => {
    const { popperRoot, outsideClickDestructor } = this.state;

    this.setState({
      showingAvatarPopup: false,
      popperRoot: null,
      outsideClickDestructor: undefined,
    });

    outsideClickDestructor?.();

    if (popperRoot && document.body.contains(popperRoot)) {
      document.body.removeChild(popperRoot);
    }
  };

  public override componentDidMount(): void {
    const useCapture = true;
    document.addEventListener('keydown', this.handleGlobalKeyDown, useCapture);
  }

  public override componentWillUnmount(): void {
    const { popperRoot, outsideClickDestructor } = this.state;

    const useCapture = true;
    outsideClickDestructor?.();
    document.removeEventListener(
      'keydown',
      this.handleGlobalKeyDown,
      useCapture
    );

    if (popperRoot && document.body.contains(popperRoot)) {
      document.body.removeChild(popperRoot);
    }
  }

  public handleGlobalKeyDown = (event: KeyboardEvent): void => {
    const { showingAvatarPopup } = this.state;
    const { key } = event;

    if (showingAvatarPopup && key === 'Escape') {
      this.hideAvatarPopup();
    }
  };

  public override render(): JSX.Element {
    const {
      areStoriesEnabled,
      avatarPath,
      badge,
      color,
      hasPendingUpdate,
      i18n,
      name,
      phoneNumber,
      profileName,
      showArchivedConversations,
      startComposing,
      startUpdate,
      theme,
      title,
      toggleProfileEditor,
      toggleStoriesView,
      unreadStoriesCount,
    } = this.props;
    const { showingAvatarPopup, popperRoot } = this.state;

    return (
      <div className="module-main-header">
        <Manager>
          <Reference>
            {({ ref }) => (
              <div
                className="module-main-header__avatar--container"
                ref={this.containerRef}
              >
                <Avatar
                  acceptedMessageRequest
                  avatarPath={avatarPath}
                  badge={badge}
                  className="module-main-header__avatar"
                  color={color}
                  conversationType="direct"
                  i18n={i18n}
                  isMe
                  phoneNumber={phoneNumber}
                  profileName={profileName}
                  theme={theme}
                  title={title}
                  // `sharedGroupNames` makes no sense for yourself, but
                  // `<Avatar>` needs it to determine blurring.
                  sharedGroupNames={[]}
                  size={AvatarSize.TWENTY_EIGHT}
                  innerRef={ref}
                  onClick={this.showAvatarPopup}
                />
                {hasPendingUpdate && (
                  <div className="module-main-header__avatar--badged" />
                )}
              </div>
            )}
          </Reference>
          {showingAvatarPopup && popperRoot
            ? createPortal(
                <Popper placement="bottom-end">
                  {({ ref, style }) => (
                    <AvatarPopup
                      acceptedMessageRequest
                      badge={badge}
                      innerRef={ref}
                      i18n={i18n}
                      isMe
                      style={{ ...style, zIndex: 10 }}
                      color={color}
                      conversationType="direct"
                      name={name}
                      phoneNumber={phoneNumber}
                      profileName={profileName}
                      theme={theme}
                      title={title}
                      avatarPath={avatarPath}
                      hasPendingUpdate={hasPendingUpdate}
                      startUpdate={startUpdate}
                      // See the comment above about `sharedGroupNames`.
                      sharedGroupNames={[]}
                      onEditProfile={() => {
                        toggleProfileEditor();
                        this.hideAvatarPopup();
                      }}
                      onViewPreferences={() => {
                        showSettings();
                        this.hideAvatarPopup();
                      }}
                      onViewArchive={() => {
                        showArchivedConversations();
                        this.hideAvatarPopup();
                      }}
                    />
                  )}
                </Popper>,
                popperRoot
              )
            : null}
        </Manager>
        <div className="module-main-header__icon-container">
          {areStoriesEnabled && (
            <button
              aria-label={i18n('stories')}
              className="module-main-header__stories-icon"
              onClick={toggleStoriesView}
              title={i18n('stories')}
              type="button"
            >
              {unreadStoriesCount ? (
                <span className="module-main-header__stories-badge">
                  {unreadStoriesCount}
                </span>
              ) : undefined}
            </button>
          )}
          <button
            aria-label={i18n('newConversation')}
            className="module-main-header__compose-icon"
            onClick={startComposing}
            title={i18n('newConversation')}
            type="button"
          />
        </div>
      </div>
    );
  }
}
