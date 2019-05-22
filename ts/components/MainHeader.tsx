import React from 'react';
import { debounce } from 'lodash';
import classNames from 'classnames';

// Use this to trigger whisper events
import { trigger } from '../shims/events';

// Use this to check for password
import { hasPassword } from '../shims/Signal';

import { Avatar } from './Avatar';
import { ContactName } from './conversation/ContactName';

import { cleanSearchTerm } from '../util/cleanSearchTerm';
import { LocalizerType } from '../types/Util';

interface MenuItem {
  id: string;
  name: string;
  onClick?: () => void;
}
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
  onCopyPublicKey?: () => void;
}

export class MainHeader extends React.Component<Props, any> {
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

    this.state = {
      expanded: false,
      hasPass: null,
      menuItems: [],
    };

    this.updateSearchBound = this.updateSearch.bind(this);
    this.clearSearchBound = this.clearSearch.bind(this);
    this.handleKeyUpBound = this.handleKeyUp.bind(this);
    this.setFocusBound = this.setFocus.bind(this);
    this.inputRef = React.createRef();

    this.debouncedSearch = debounce(this.search.bind(this), 20);
  }

  public componentWillMount() {
    // tslint:disable-next-line
    this.updateHasPass();
  }

  public componentDidUpdate(_prevProps: Props, prevState: any) {
    if (prevState.hasPass !== this.state.hasPass) {
      this.updateMenuItems();
    }
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
    const { onClick } = this.props;

    return (
      <div role="button" className="module-main-header" onClick={onClick}>
        <div className="module-main-header__container">
          {this.renderName()}
          {this.renderMenu()}
        </div>
        {this.renderSearch()}
      </div>
    );
  }

  private renderName() {
    const {
      avatarPath,
      i18n,
      color,
      name,
      phoneNumber,
      profileName,
    } = this.props;

    const { expanded } = this.state;

    return (
      <div
        role="button"
        className="module-main-header__title"
        onClick={() => {
          this.setState({ expanded: !expanded });
        }}
      >
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
        <div
          className={classNames(
            'module-main-header-content-toggle',
            expanded && 'module-main-header-content-toggle-visible'
          )}
        />
      </div>
    );
  }

  private renderMenu() {
    const { expanded, menuItems } = this.state;

    return (
      <div className="module-main-header__menu">
        <div className={classNames('accordian', expanded && 'expanded')}>
          {menuItems.map((item: MenuItem) => (
            <div
              role="button"
              className="menu-item"
              key={item.id}
              onClick={item.onClick}
            >
              {item.name}
            </div>
          ))}
        </div>
      </div>
    );
  }

  private renderSearch() {
    const { searchTerm, i18n } = this.props;

    return (
      <div className="module-main-header__search">
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
        <span
          role="button"
          className="module-main-header__search__icon"
          onClick={this.setFocusBound}
        />
        {searchTerm ? (
          <span
            role="button"
            className="module-main-header__search__cancel-icon"
            onClick={this.clearSearchBound}
          />
        ) : null}
      </div>
    );
  }

  private async updateHasPass() {
    const hasPass = await hasPassword();
    this.setState({ hasPass });
  }

  private updateMenuItems() {
    const { i18n, onCopyPublicKey } = this.props;
    const { hasPass } = this.state;

    const menuItems = [
      {
        id: 'copyPublicKey',
        name: i18n('copyPublicKey'),
        onClick: onCopyPublicKey,
      },
      {
        id: 'editDisplayName',
        name: i18n('editDisplayName'),
        onClick: () => {
          trigger('onEditProfile');
        },
      },
      {
        id: 'showSeed',
        name: i18n('showSeed'),
        onClick: () => {
          trigger('showSeedDialog');
        },
      },
    ];

    const passItem = (type: string) => ({
      id: `${type}Password`,
      name: i18n(`${type}Password`),
      onClick: () => {
        trigger('showPasswordDialog', {
          type,
          resolve: () => {
            trigger('showToast', {
              message: i18n(`${type}PasswordSuccess`),
            });
            setTimeout(async () => this.updateHasPass(), 100);
          },
        });
      },
    });

    if (hasPass) {
      menuItems.push(passItem('change'), passItem('remove'));
    } else {
      menuItems.push(passItem('set'));
    }

    this.setState({ menuItems });
  }
}
