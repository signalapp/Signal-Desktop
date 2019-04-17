import React from 'react';
import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { LeftPane } from '../../components/LeftPane';
import { StateType } from '../reducer';

import { getQuery, getSearchResults, isSearching } from '../selectors/search';
import { getIntl } from '../selectors/user';
import { getLeftPaneList, getMe } from '../selectors/conversations';

import { SmartMainHeader } from './MainHeader';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363
const FilteredSmartMainHeader = SmartMainHeader as any;

const mapStateToProps = (state: StateType) => {
  const showSearch = isSearching(state);

  return {
    i18n: getIntl(state),
    me: getMe(state),
    query: getQuery(state),
    conversations: showSearch ? undefined : getLeftPaneList(state),
    searchResults: showSearch ? getSearchResults(state) : undefined,
    renderMainHeader: () => <FilteredSmartMainHeader />,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartLeftPane = smart(LeftPane);
