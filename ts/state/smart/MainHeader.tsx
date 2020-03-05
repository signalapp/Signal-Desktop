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
import {
  getIntl,
  getRegionCode,
  getUserConversationId,
  getUserNumber,
  getUserUuid,
} from '../selectors/user';
import { getMe } from '../selectors/conversations';

const mapStateToProps = (state: StateType) => {
  return {
    searchTerm: getQuery(state),
    searchConversationId: getSearchConversationId(state),
    searchConversationName: getSearchConversationName(state),
    startSearchCounter: getStartSearchCounter(state),
    regionCode: getRegionCode(state),
    ourConversationId: getUserConversationId(state),
    ourNumber: getUserNumber(state),
    ourUuid: getUserUuid(state),
    ...getMe(state),
    i18n: getIntl(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartMainHeader = smart(MainHeader);
