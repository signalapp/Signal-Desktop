import { connect } from 'react-redux';
import { LeftPane } from '../../components/LeftPane';
import { StateType } from '../reducer';

import { getQuery, getSearchResults, isSearching } from '../selectors/search';
import {
  getIntl,
  getIsSecondaryDevice,
  getRegionCode,
  getUserNumber,
} from '../selectors/user';
import {
  getLeftPaneLists,
  getOurPrimaryConversation,
} from '../selectors/conversations';
import { mapDispatchToProps } from '../actions';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363

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
    ourNumber: getUserNumber(state),
    isSecondaryDevice: getIsSecondaryDevice(state),
    searchResults,
    i18n: getIntl(state),
    unreadMessageCount: leftPaneList.unreadCount,
    theme: state.theme,
    focusedSection: state.section.focusedSection,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartLeftPane = smart(LeftPane);
