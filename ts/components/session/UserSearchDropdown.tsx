import React from 'react';

import { UserSearchResults } from '../UserSearchResults';
import { SessionSearchInput } from './SessionSearchInput';

import { PropsData as SearchResultsProps } from '../SearchResults';

export interface Props {
  searchTerm: string;
  placeholder: string;
  searchResults?: SearchResultsProps;
  updateSearch: (searchTerm: string) => void;
}

interface State {
  selectedContact: number;
}

export class UserSearchDropdown extends React.Component<Props, State> {
  private readonly updateSearchBound: (searchedString: string) => void;

  public constructor(props: Props) {
    super(props);
    this.updateSearchBound = this.updateSearch.bind(this);
    this.handleNavigation = this.handleNavigation.bind(this);
    this.handleContactSelected = this.handleContactSelected.bind(this);
    this.state = {
      selectedContact: -1,
    };
  }

  public handleNavigation(e: any) {
    const { selectedContact } = this.state;
    const { searchResults } = this.props;
    // arrow up/down button should select next/previous list element
    if (
      e.keyCode === 38 &&
      selectedContact > 0 &&
      searchResults &&
      searchResults.contacts.length > 0
    ) {
      this.setState(prevState => ({
        selectedContact: +prevState.selectedContact - 1,
      }));
    } else if (
      e.keyCode === 40 &&
      searchResults &&
      selectedContact < searchResults.contacts.length - 1
    ) {
      this.setState(prevState => ({
        selectedContact: +prevState.selectedContact + 1,
      }));
    } else if (
      e.key === 'Enter' &&
      searchResults &&
      searchResults.contacts.length > 0
    ) {
      this.handleContactSelected(
        searchResults.contacts[selectedContact].phoneNumber
      );
    }
  }

  public render() {
    const { searchResults, placeholder } = this.props;
    const { selectedContact } = this.state;

    return (
      <div className="user-search-dropdown">
        <SessionSearchInput
          searchString={this.props.searchTerm}
          onChange={this.updateSearchBound}
          placeholder={placeholder}
          handleNavigation={this.handleNavigation}
        />
        {searchResults && (
          <UserSearchResults
            {...searchResults}
            selectedContact={selectedContact}
            onContactSelected={this.handleContactSelected}
          />
        )}
      </div>
    );
  }

  public updateSearch(data: string) {
    this.setState({ selectedContact: -1 });
    this.props.updateSearch(data);
  }

  public handleContactSelected(key: string) {
    this.updateSearch(key);
  }
}
