import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';

import { MainHeader } from '../../components/MainHeader';
import { StateType } from '../reducer';

import {
  getQuery,
  getSearchConversationId,
  getSearchConversationName,
  getStartSearchCounter,
} from '../selectors/search';
import { getIntl, getRegionCode, getUserNumber } from '../selectors/user';
import { getMe } from '../selectors/conversations';

const mapStateToProps = (state: StateType) => {
  return {
    searchTerm: getQuery(state),
    searchConversationId: getSearchConversationId(state),
    searchConversationName: getSearchConversationName(state),
    startSearchCounter: getStartSearchCounter(state),
    regionCode: getRegionCode(state),
    ourNumber: getUserNumber(state),
    ...getMe(state),
    i18n: getIntl(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartMainHeader = smart(MainHeader);
