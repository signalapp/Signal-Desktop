import React from 'react';
import classNames from 'classnames';
import { debounce } from 'lodash';
import { Manager, Popper, Reference } from 'react-popper';
import { createPortal } from 'react-dom';

import { showSettings } from '../shims/Whisper';
import { Avatar } from './Avatar';
import { AvatarPopup } from './AvatarPopup';
import { LocalizerType } from '../types/Util';

export interface PropsType {
  searchTerm: string;
  searchConversationName?: string;
  searchConversationId?: string;
  startSearchCounter: number;

  // To be used as an ID
  ourNumber: string;
  regionCode: string;

  // For display
  phoneNumber: string;
  isMe: boolean;
  name?: string;
  color: string;
  verified: boolean;
  profileName?: string;
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
      ourNumber: string;
      noteToSelf: string;
    }
  ) => void;

  clearConversationSearch: () => void;
  clearSearch: () => void;

  showArchivedConversations: () => void;
}

interface StateType {
  showingAvatarPopup: boolean;
  popperRoot: HTMLDivElement | null;
}

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

  public componentDidUpdate(prevProps: PropsType) {
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

  public handleOutsideClick = ({ target }: MouseEvent) => {
    const { popperRoot, showingAvatarPopup } = this.state;

    if (
      showingAvatarPopup &&
      popperRoot &&
      !popperRoot.contains(target as Node)
    ) {
      this.hideAvatarPopup();
    }
  };

  public handleOutsideKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      this.hideAvatarPopup();
    }
  };

  public showAvatarPopup = () => {
    const popperRoot = document.createElement('div');
    document.body.appendChild(popperRoot);

    this.setState({
      showingAvatarPopup: true,
      popperRoot,
    });
    document.addEventListener('click', this.handleOutsideClick);
    document.addEventListener('keydown', this.handleOutsideKeyDown);
  };

  public hideAvatarPopup = () => {
    const { popperRoot } = this.state;

    document.removeEventListener('click', this.handleOutsideClick);
    document.removeEventListener('keydown', this.handleOutsideKeyDown);

    this.setState({
      showingAvatarPopup: false,
      popperRoot: null,
    });

    if (popperRoot && document.body.contains(popperRoot)) {
      document.body.removeChild(popperRoot);
    }
  };

  public componentWillUnmount() {
    const { popperRoot } = this.state;

    document.removeEventListener('click', this.handleOutsideClick);
    document.removeEventListener('keydown', this.handleOutsideKeyDown);

    if (popperRoot && document.body.contains(popperRoot)) {
      document.body.removeChild(popperRoot);
    }
  }

  // tslint:disable-next-line member-ordering
  public search = debounce((searchTerm: string) => {
    const {
      i18n,
      ourNumber,
      regionCode,
      searchDiscussions,
      searchMessages,
      searchConversationId,
    } = this.props;

    if (searchDiscussions && !searchConversationId) {
      searchDiscussions(searchTerm, {
        noteToSelf: i18n('noteToSelf').toLowerCase(),
        ourNumber,
      });
    }

    if (searchMessages) {
      searchMessages(searchTerm, {
        searchConversationId,
        regionCode,
      });
    }
  }, 200);

  public updateSearch = (event: React.FormEvent<HTMLInputElement>) => {
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

  public clearSearch = () => {
    const { clearSearch } = this.props;

    clearSearch();
    this.setFocus();
  };

  public clearConversationSearch = () => {
    const { clearConversationSearch } = this.props;

    clearConversationSearch();
    this.setFocus();
  };

  public handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const {
      clearConversationSearch,
      clearSearch,
      searchConversationId,
      searchTerm,
    } = this.props;

    const { ctrlKey, metaKey, key } = event;
    const ctrlOrCommand = ctrlKey || metaKey;

    // On linux, this keyboard combination selects all text
    if (ctrlOrCommand && key === '/') {
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

  public handleXButton = () => {
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

  public setFocus = () => {
    if (this.inputRef.current) {
      // @ts-ignore
      this.inputRef.current.focus();
    }
  };

  public setSelected = () => {
    if (this.inputRef.current) {
      // @ts-ignore
      this.inputRef.current.select();
    }
  };

  // tslint:disable-next-line:max-func-body-length
  public render() {
    const {
      avatarPath,
      color,
      i18n,
      name,
      phoneNumber,
      profileName,
      searchConversationId,
      searchConversationName,
      searchTerm,
      showArchivedConversations,
    } = this.props;
    const { showingAvatarPopup, popperRoot } = this.state;

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
                size={28}
                innerRef={ref}
                onClick={this.showAvatarPopup}
              />
            )}
          </Reference>
          {showingAvatarPopup && popperRoot
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
                      avatarPath={avatarPath}
                      size={28}
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
            />
          ) : null}
        </div>
      </div>
    );
  }
}
