import React from 'react';
import { debounce } from 'lodash';

import { Avatar } from './Avatar';
import { ContactName } from './conversation/ContactName';

import { cleanSearchTerm } from '../util/cleanSearchTerm';
import { LocalizerType } from '../types/Util';

export interface Props {
  searchTerm: string;

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
  search: (
    query: string,
    options: {
      regionCode: string;
      ourNumber: string;
      noteToSelf: string;
    }
  ) => void;
  clearSearch: () => void;

  onClick?: () => void;
}

export class MainHeader extends React.Component<Props> {
  private readonly updateSearchBound: (
    event: React.FormEvent<HTMLInputElement>
  ) => void;
  private readonly clearSearchBound: () => void;
  private readonly handleKeyUpBound: (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => void;
  private readonly setFocusBound: () => void;
  private readonly inputRef: React.RefObject<HTMLInputElement>;
  private readonly debouncedSearch: (searchTerm: string) => void;

  constructor(props: Props) {
    super(props);

    this.updateSearchBound = this.updateSearch.bind(this);
    this.clearSearchBound = this.clearSearch.bind(this);
    this.handleKeyUpBound = this.handleKeyUp.bind(this);
    this.setFocusBound = this.setFocus.bind(this);
    this.inputRef = React.createRef();

    this.debouncedSearch = debounce(this.search.bind(this), 20);
  }

  public search() {
    const { searchTerm, search, i18n, ourNumber, regionCode } = this.props;
    if (search) {
      search(searchTerm, {
        noteToSelf: i18n('noteToSelf').toLowerCase(),
        ourNumber,
        regionCode,
      });
    }
  }

  public updateSearch(event: React.FormEvent<HTMLInputElement>) {
    const { updateSearchTerm, clearSearch } = this.props;
    const searchTerm = event.currentTarget.value;

    if (!searchTerm) {
      clearSearch();

      return;
    }

    if (updateSearchTerm) {
      updateSearchTerm(searchTerm);
    }

    if (searchTerm.length < 2) {
      return;
    }

    const cleanedTerm = cleanSearchTerm(searchTerm);
    if (!cleanedTerm) {
      return;
    }

    this.debouncedSearch(cleanedTerm);
  }

  public clearSearch() {
    const { clearSearch } = this.props;

    clearSearch();
    this.setFocus();
  }

  public handleKeyUp(event: React.KeyboardEvent<HTMLInputElement>) {
    const { clearSearch } = this.props;

    if (event.key === 'Escape') {
      clearSearch();
    }
  }

  public setFocus() {
    if (this.inputRef.current) {
      // @ts-ignore
      this.inputRef.current.focus();
    }
  }

  public render() {
    const {
      searchTerm,
      avatarPath,
      i18n,
      color,
      name,
      phoneNumber,
      profileName,
      onClick,
    } = this.props;

    return (
      <div role="button" className="module-main-header" onClick={onClick}>
        <Avatar
          avatarPath={avatarPath}
          color={color}
          conversationType="direct"
          i18n={i18n}
          name={name}
          phoneNumber={phoneNumber}
          profileName={profileName}
          size={28}
        />
        <div className="module-main-header__contact-name">
          <ContactName
            phoneNumber={phoneNumber}
            profileName={profileName}
            i18n={i18n}
          />
        </div>
        <div className="module-main-header__search">
          <div
            role="button"
            className="module-main-header__search__icon"
            onClick={this.setFocusBound}
          />
          <input
            type="text"
            ref={this.inputRef}
            className="module-main-header__search__input"
            placeholder={i18n('search')}
            dir="auto"
            onKeyUp={this.handleKeyUpBound}
            value={searchTerm}
            onChange={this.updateSearchBound}
          />
          {searchTerm ? (
            <div
              role="button"
              className="module-main-header__search__cancel-icon"
              onClick={this.clearSearchBound}
            />
          ) : null}
        </div>
      </div>
    );
  }
}
