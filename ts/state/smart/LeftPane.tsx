import { connect } from 'react-redux';
import { LeftPane } from '../../components/LeftPane';
import { StateType } from '../reducer';

import { getQuery, getSearchResults, isSearching } from '../selectors/search';
import { getIntl, getOurNumber, getRegionCode } from '../selectors/user';
import {
  getLeftPaneLists,
  getOurPrimaryConversation,
} from '../selectors/conversations';
import { mapDispatchToProps } from '../actions';
import { getFocusedSection } from '../selectors/section';
import { getTheme } from '../selectors/theme';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/3136k3

const mapStateToProps = (state: StateType) => {
  const showSearch = isSearching(state);

  const leftPaneList = getLeftPaneLists(state);
  const lists = showSearch ? undefined : leftPaneList;
  const searchResults = showSearch ? getSearchResults(state) : undefined;
  return {
    ...lists,
    ourPrimaryConversation: getOurPrimaryConversation(state), // used in actionPanel
    searchTerm: getQuery(state),
    regionCode: getRegionCode(state),
    ourNumber: getOurNumber(state),
    searchResults,
    i18n: getIntl(state),
    unreadMessageCount: leftPaneList.unreadCount,
    theme: getTheme(state),
    focusedSection: getFocusedSection(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartLeftPane = smart(LeftPane);
