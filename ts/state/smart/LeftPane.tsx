import React from 'react';
import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { LeftPane } from '../../components/LeftPane';
import { StateType } from '../reducer';

import { getSearchResults, isSearching } from '../selectors/search';
import { getIntl } from '../selectors/user';
import { getLeftPaneLists, getShowArchived } from '../selectors/conversations';

import { SmartMainHeader } from './MainHeader';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363
const FilteredSmartMainHeader = SmartMainHeader as any;

const mapStateToProps = (state: StateType) => {
  const showSearch = isSearching(state);

  const lists = showSearch ? undefined : getLeftPaneLists(state);
  const searchResults = showSearch ? getSearchResults(state) : undefined;

  return {
    ...lists,
    searchResults,
    showArchived: getShowArchived(state),
    i18n: getIntl(state),
    renderMainHeader: () => <FilteredSmartMainHeader />,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartLeftPane = smart(LeftPane);
