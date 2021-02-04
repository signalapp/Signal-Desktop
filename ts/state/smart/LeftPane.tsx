// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

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
import { SmartRelinkDialog } from './RelinkDialog';
import { SmartUpdateDialog } from './UpdateDialog';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363
/* eslint-disable @typescript-eslint/no-explicit-any */
const FilteredSmartMessageSearchResult = SmartMessageSearchResult as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

function renderExpiredBuildDialog(): JSX.Element {
  return <SmartExpiredBuildDialog />;
}
function renderMainHeader(): JSX.Element {
  return <SmartMainHeader />;
}
function renderMessageSearchResult(id: string): JSX.Element {
  return <FilteredSmartMessageSearchResult id={id} />;
}
function renderNetworkStatus(): JSX.Element {
  return <SmartNetworkStatus />;
}
function renderRelinkDialog(): JSX.Element {
  return <SmartRelinkDialog />;
}
function renderUpdateDialog(): JSX.Element {
  return <SmartUpdateDialog />;
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
    renderRelinkDialog,
    renderUpdateDialog,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartLeftPane = smart(LeftPane);
