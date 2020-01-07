import React from 'react';
import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { LeftPane } from '../../components/LeftPane';
import { StateType } from '../reducer';

import { getSearchResults, isSearching } from '../selectors/search';
import { getIntl } from '../selectors/user';
import {
  getLeftPaneLists,
  getSelectedConversation,
  getShowArchived,
} from '../selectors/conversations';

import { SmartMainHeader } from './MainHeader';
import { SmartMessageSearchResult } from './MessageSearchResult';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363
const FilteredSmartMainHeader = SmartMainHeader as any;
const FilteredSmartMessageSearchResult = SmartMessageSearchResult as any;

function renderMainHeader(): JSX.Element {
  return <FilteredSmartMainHeader />;
}
function renderMessageSearchResult(id: string): JSX.Element {
  return <FilteredSmartMessageSearchResult id={id} />;
}

const mapStateToProps = (state: StateType) => {
  const showSearch = isSearching(state);

  const lists = showSearch ? undefined : getLeftPaneLists(state);
  const searchResults = showSearch ? getSearchResults(state) : undefined;
  const selectedConversationId = getSelectedConversation(state);

  return {
    ...lists,
    searchResults,
    selectedConversationId,
    showArchived: getShowArchived(state),
    i18n: getIntl(state),
    renderMainHeader,
    renderMessageSearchResult,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartLeftPane = smart(LeftPane);
