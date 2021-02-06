// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';
import { debounce, get } from 'lodash';
import { Manager, Popper, Reference } from 'react-popper';
import { createPortal } from 'react-dom';

import { showSettings } from '../shims/Whisper';
import { Avatar } from './Avatar';
import { AvatarPopup } from './AvatarPopup';
import { LocalizerType } from '../types/Util';
import { ColorType } from '../types/Colors';

export type PropsType = {
  searchTerm: string;
  searchConversationName?: string;
  searchConversationId?: string;
  startSearchCounter: number;

  // To be used as an ID
  ourConversationId: string;
  ourUuid: string;
  ourNumber: string;
  regionCode: string;

  // For display
  phoneNumber?: string;
  isMe?: boolean;
  name?: string;
  color?: ColorType;
  isVerified?: boolean;
  profileName?: string;
  title: string;
  avatarPath?: string;

  i18n: LocalizerType;
  updateSearchTerm: (searchTerm: string) => void;
  searchMessages: (
    query: string,
    options: {
      searchConversationId?: string;
      regionCode: string;
    }
  ) => void;
  searchDiscussions: (
    query: string,
    options: {
      ourConversationId: string;
      ourNumber: string;
      ourUuid: string;
      noteToSelf: string;
    }
  ) => void;

  clearConversationSearch: () => void;
  clearSearch: () => void;

  showArchivedConversations: () => void;
};

enum AvatarPopupState {
  HIDDEN = 0,
  VISIBLE = 1,
  FADEOUT = 2,
}

type StateType = {
  avatarPopupState: AvatarPopupState;
  popperRoot: HTMLDivElement | null;
};

export class MainHeader extends React.Component<PropsType, StateType> {
  private readonly inputRef: React.RefObject<HTMLInputElement>;

  constructor(props: PropsType) {
    super(props);

    this.inputRef = React.createRef();

    this.state = {
      avatarPopupState: AvatarPopupState.HIDDEN,
      popperRoot: null,
    };
  }

  public componentDidUpdate(prevProps: PropsType): void {
    const { searchConversationId, startSearchCounter } = this.props;

    // When user chooses to search in a given conversation we focus the field for them
    if (
      searchConversationId &&
      searchConversationId !== prevProps.searchConversationId
    ) {
      this.setFocus();
    }
    // When user chooses to start a new search, we focus the field
    if (startSearchCounter !== prevProps.startSearchCounter) {
      this.setSelected();
    }
  }

  public handleOutsideClick = ({ target }: MouseEvent): void => {
    const { popperRoot, avatarPopupState } = this.state;

    if (
      avatarPopupState &&
      popperRoot &&
      !popperRoot.contains(target as Node)
    ) {
      this.hideAvatarPopup();
    }
  };

  public handleOutsideKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      this.hideAvatarPopup();
    }
  };

  public showAvatarPopup = (): void => {
    const { avatarPopupState } = this.state;
    if (avatarPopupState === AvatarPopupState.HIDDEN) {
      const popperRoot = document.createElement('div');
      document.body.appendChild(popperRoot);

      this.setState({
        avatarPopupState: AvatarPopupState.VISIBLE,
        popperRoot,
      });
      document.addEventListener('click', this.handleOutsideClick);
      document.addEventListener('keydown', this.handleOutsideKeyDown);
    }
  };

  public hideAvatarPopup = (): void => {
    const { popperRoot } = this.state;

    document.removeEventListener('click', this.handleOutsideClick);
    document.removeEventListener('keydown', this.handleOutsideKeyDown);

    this.setState({
      avatarPopupState: AvatarPopupState.FADEOUT,
      popperRoot,
    });

    setTimeout(() => {
      this.setState({
        avatarPopupState: AvatarPopupState.HIDDEN,
        popperRoot: null,
      });
      if (popperRoot && document.body.contains(popperRoot)) {
        document.body.removeChild(popperRoot);
      }
    }, 150);
  };

  public componentWillUnmount(): void {
    const { popperRoot } = this.state;

    document.removeEventListener('click', this.handleOutsideClick);
    document.removeEventListener('keydown', this.handleOutsideKeyDown);

    if (popperRoot && document.body.contains(popperRoot)) {
      document.body.removeChild(popperRoot);
    }
  }

  public search = debounce((searchTerm: string): void => {
    const {
      i18n,
      ourConversationId,
      ourNumber,
      ourUuid,
      regionCode,
      searchDiscussions,
      searchMessages,
      searchConversationId,
    } = this.props;

    if (searchDiscussions && !searchConversationId) {
      searchDiscussions(searchTerm, {
        noteToSelf: i18n('noteToSelf').toLowerCase(),
        ourConversationId,
        ourNumber,
        ourUuid,
      });
    }

    if (searchMessages) {
      searchMessages(searchTerm, {
        searchConversationId,
        regionCode,
      });
    }
  }, 200);

  public updateSearch = (event: React.FormEvent<HTMLInputElement>): void => {
    const {
      updateSearchTerm,
      clearConversationSearch,
      clearSearch,
      searchConversationId,
    } = this.props;
    const searchTerm = event.currentTarget.value;

    if (!searchTerm) {
      if (searchConversationId) {
        clearConversationSearch();
      } else {
        clearSearch();
      }

      return;
    }

    if (updateSearchTerm) {
      updateSearchTerm(searchTerm);
    }

    if (searchTerm.length < 2) {
      return;
    }

    this.search(searchTerm);
  };

  public clearSearch = (): void => {
    const { clearSearch } = this.props;

    clearSearch();
    this.setFocus();
  };

  public clearConversationSearch = (): void => {
    const { clearConversationSearch } = this.props;

    clearConversationSearch();
    this.setFocus();
  };

  public handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ): void => {
    const {
      clearConversationSearch,
      clearSearch,
      searchConversationId,
      searchTerm,
    } = this.props;

    const { ctrlKey, metaKey, key } = event;
    const commandKey = get(window, 'platform') === 'darwin' && metaKey;
    const controlKey = get(window, 'platform') !== 'darwin' && ctrlKey;
    const commandOrCtrl = commandKey || controlKey;

    // On linux, this keyboard combination selects all text
    if (commandOrCtrl && key === '/') {
      event.preventDefault();
      event.stopPropagation();

      return;
    }

    if (key !== 'Escape') {
      return;
    }

    if (searchConversationId && searchTerm) {
      clearConversationSearch();
    } else {
      clearSearch();
    }

    event.preventDefault();
    event.stopPropagation();
  };

  public handleXButton = (): void => {
    const {
      searchConversationId,
      clearConversationSearch,
      clearSearch,
    } = this.props;

    if (searchConversationId) {
      clearConversationSearch();
    } else {
      clearSearch();
    }

    this.setFocus();
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

  public render(): JSX.Element {
    const {
      avatarPath,
      color,
      i18n,
      name,
      phoneNumber,
      profileName,
      title,
      searchConversationId,
      searchConversationName,
      searchTerm,
      showArchivedConversations,
    } = this.props;
    const { avatarPopupState, popperRoot } = this.state;

    const placeholder = searchConversationName
      ? i18n('searchIn', [searchConversationName])
      : i18n('search');

    return (
      <div className="module-main-header">
        <Manager>
          <Reference>
            {({ ref }) => (
              <Avatar
                avatarPath={avatarPath}
                color={color}
                conversationType="direct"
                i18n={i18n}
                name={name}
                phoneNumber={phoneNumber}
                profileName={profileName}
                title={title}
                size={28}
                innerRef={ref}
                onClick={this.showAvatarPopup}
              />
            )}
          </Reference>
          {avatarPopupState && popperRoot
            ? createPortal(
                <Popper placement="bottom-end">
                  {({ ref, style }) => (
                    <AvatarPopup
                      innerRef={ref}
                      i18n={i18n}
                      style={style}
                      color={color}
                      conversationType="direct"
                      name={name}
                      phoneNumber={phoneNumber}
                      profileName={profileName}
                      title={title}
                      avatarPath={avatarPath}
                      size={28}
                      fadeout={avatarPopupState === AvatarPopupState.FADEOUT}
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
        <div className="module-main-header__search">
          {searchConversationId ? (
            <button
              className="module-main-header__search__in-conversation-pill"
              onClick={this.clearSearch}
              tabIndex={-1}
              type="button"
              aria-label={i18n('clearSearch')}
            >
              <div className="module-main-header__search__in-conversation-pill__avatar-container">
                <div className="module-main-header__search__in-conversation-pill__avatar" />
              </div>
              <div className="module-main-header__search__in-conversation-pill__x-button" />
            </button>
          ) : (
            <button
              className="module-main-header__search__icon"
              onClick={this.setFocus}
              tabIndex={-1}
              type="button"
              aria-label={i18n('search')}
            />
          )}
          <input
            type="text"
            ref={this.inputRef}
            className={classNames(
              'module-main-header__search__input',
              searchTerm
                ? 'module-main-header__search__input--with-text'
                : null,
              searchConversationId
                ? 'module-main-header__search__input--in-conversation'
                : null
            )}
            placeholder={placeholder}
            dir="auto"
            onKeyDown={this.handleKeyDown}
            value={searchTerm}
            onChange={this.updateSearch}
          />
          {searchTerm ? (
            <button
              tabIndex={-1}
              className="module-main-header__search__cancel-icon"
              onClick={this.handleXButton}
              type="button"
              aria-label={i18n('cancel')}
            />
          ) : null}
        </div>
      </div>
    );
  }
}
