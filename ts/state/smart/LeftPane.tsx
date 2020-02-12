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

import { SmartExpiredBuildDialog } from './ExpiredBuildDialog';
import { SmartMainHeader } from './MainHeader';
import { SmartMessageSearchResult } from './MessageSearchResult';
import { SmartNetworkStatus } from './NetworkStatus';
import { SmartUpdateDialog } from './UpdateDialog';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363
const FilteredSmartMainHeader = SmartMainHeader as any;
const FilteredSmartMessageSearchResult = SmartMessageSearchResult as any;
const FilteredSmartNetworkStatus = SmartNetworkStatus as any;
const FilteredSmartUpdateDialog = SmartUpdateDialog as any;
const FilteredSmartExpiredBuildDialog = SmartExpiredBuildDialog as any;

function renderExpiredBuildDialog(): JSX.Element {
  return <FilteredSmartExpiredBuildDialog />;
}
function renderMainHeader(): JSX.Element {
  return <FilteredSmartMainHeader />;
}
function renderMessageSearchResult(id: string): JSX.Element {
  return <FilteredSmartMessageSearchResult id={id} />;
}
function renderUpdateDialog(): JSX.Element {
  return <FilteredSmartUpdateDialog />;
}
function renderNetworkStatus(): JSX.Element {
  return <FilteredSmartNetworkStatus />;
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
    renderExpiredBuildDialog,
    renderMainHeader,
    renderMessageSearchResult,
    renderNetworkStatus,
    renderUpdateDialog,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartLeftPane = smart(LeftPane);
