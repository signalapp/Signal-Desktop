// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Manager, Popper, Reference } from 'react-popper';
import { createPortal } from 'react-dom';

import { showSettings } from '../shims/Whisper';
import { Avatar } from './Avatar';
import { AvatarPopup } from './AvatarPopup';
import type { LocalizerType, ThemeType } from '../types/Util';
import type { AvatarColorType } from '../types/Colors';
import type { ConversationType } from '../state/ducks/conversations';
import { LeftPaneSearchInput } from './LeftPaneSearchInput';
import type { BadgeType } from '../badges/types';

export type PropsType = {
  searchTerm: string;
  searchConversation: undefined | ConversationType;
  startSearchCounter: number;
  selectedConversation: undefined | ConversationType;

  // For display
  phoneNumber?: string;
  isMe?: boolean;
  name?: string;
  color?: AvatarColorType;
  disabled?: boolean;
  isVerified?: boolean;
  profileName?: string;
  title: string;
  avatarPath?: string;
  badge?: BadgeType;
  hasPendingUpdate: boolean;
  theme: ThemeType;

  i18n: LocalizerType;

  updateSearchTerm: (searchTerm: string) => void;
  startUpdate: () => unknown;
  clearConversationSearch: () => void;
  clearSearch: () => void;

  showArchivedConversations: () => void;
  startComposing: () => void;
  toggleProfileEditor: () => void;
};

type StateType = {
  showingAvatarPopup: boolean;
  popperRoot: HTMLDivElement | null;
};

export class MainHeader extends React.Component<PropsType, StateType> {
  private readonly inputRef: React.RefObject<HTMLInputElement>;

  constructor(props: PropsType) {
    super(props);

    this.inputRef = React.createRef();

    this.state = {
      showingAvatarPopup: false,
      popperRoot: null,
    };
  }

  public override componentDidUpdate(prevProps: PropsType): void {
    const { searchConversation, startSearchCounter } = this.props;

    // When user chooses to search in a given conversation we focus the field for them
    if (
      searchConversation &&
      searchConversation.id !== prevProps.searchConversation?.id
    ) {
      this.setFocus();
    }
    // When user chooses to start a new search, we focus the field
    if (startSearchCounter !== prevProps.startSearchCounter) {
      this.setSelected();
    }
  }

  public handleOutsideClick = ({ target }: MouseEvent): void => {
    const { popperRoot, showingAvatarPopup } = this.state;

    if (
      showingAvatarPopup &&
      popperRoot &&
      !popperRoot.contains(target as Node)
    ) {
      this.hideAvatarPopup();
    }
  };

  public showAvatarPopup = (): void => {
    const popperRoot = document.createElement('div');
    document.body.appendChild(popperRoot);

    this.setState({
      showingAvatarPopup: true,
      popperRoot,
    });
    document.addEventListener('click', this.handleOutsideClick);
  };

  public hideAvatarPopup = (): void => {
    const { popperRoot } = this.state;

    document.removeEventListener('click', this.handleOutsideClick);

    this.setState({
      showingAvatarPopup: false,
      popperRoot: null,
    });

    if (popperRoot && document.body.contains(popperRoot)) {
      document.body.removeChild(popperRoot);
    }
  };

  public override componentDidMount(): void {
    document.addEventListener('keydown', this.handleGlobalKeyDown);
  }

  public override componentWillUnmount(): void {
    const { popperRoot } = this.state;

    document.removeEventListener('click', this.handleOutsideClick);
    document.removeEventListener('keydown', this.handleGlobalKeyDown);

    if (popperRoot && document.body.contains(popperRoot)) {
      document.body.removeChild(popperRoot);
    }
  }

  private updateSearch = (searchTerm: string): void => {
    const {
      updateSearchTerm,
      clearConversationSearch,
      clearSearch,
      searchConversation,
    } = this.props;

    if (!searchTerm) {
      if (searchConversation) {
        clearConversationSearch();
      } else {
        clearSearch();
      }

      return;
    }

    if (updateSearchTerm) {
      updateSearchTerm(searchTerm);
    }
  };

  public clearSearch = (): void => {
    const { clearSearch } = this.props;
    clearSearch();
    this.setFocus();
  };

  private handleInputBlur = (): void => {
    const { clearSearch, searchConversation, searchTerm } = this.props;
    if (!searchConversation && !searchTerm) {
      clearSearch();
    }
  };

  public handleGlobalKeyDown = (event: KeyboardEvent): void => {
    const { showingAvatarPopup } = this.state;
    const { key } = event;

    if (showingAvatarPopup && key === 'Escape') {
      this.hideAvatarPopup();
    }
  };

  public setFocus = (): void => {
    if (this.inputRef.current) {
      this.inputRef.current.focus();
    }
  };

  public setSelected = (): void => {
    if (this.inputRef.current) {
      this.inputRef.current.select();
    }
  };

  public override render(): JSX.Element {
    const {
      avatarPath,
      badge,
      color,
      disabled,
      hasPendingUpdate,
      i18n,
      name,
      phoneNumber,
      profileName,
      searchConversation,
      searchTerm,
      showArchivedConversations,
      startComposing,
      startUpdate,
      theme,
      title,
      toggleProfileEditor,
    } = this.props;
    const { showingAvatarPopup, popperRoot } = this.state;

    const isSearching = Boolean(searchConversation || searchTerm.trim().length);

    return (
      <div className="module-main-header">
        <Manager>
          <Reference>
            {({ ref }) => (
              <div className="module-main-header__avatar--container">
                <Avatar
                  acceptedMessageRequest
                  avatarPath={avatarPath}
                  badge={badge}
                  className="module-main-header__avatar"
                  color={color}
                  conversationType="direct"
                  i18n={i18n}
                  isMe
                  name={name}
                  phoneNumber={phoneNumber}
                  profileName={profileName}
                  theme={theme}
                  title={title}
                  // `sharedGroupNames` makes no sense for yourself, but
                  // `<Avatar>` needs it to determine blurring.
                  sharedGroupNames={[]}
                  size={28}
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
                      size={28}
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
        <LeftPaneSearchInput
          disabled={disabled}
          i18n={i18n}
          onBlur={this.handleInputBlur}
          onChangeValue={this.updateSearch}
          onClear={this.clearSearch}
          ref={this.inputRef}
          searchConversation={searchConversation}
          value={searchTerm}
        />
        {!isSearching && (
          <button
            aria-label={i18n('newConversation')}
            className="module-main-header__compose-icon"
            onClick={startComposing}
            title={i18n('newConversation')}
            type="button"
          />
        )}
      </div>
    );
  }
}
