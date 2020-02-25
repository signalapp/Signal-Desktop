import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { SessionConversation } from '../../components/session/SessionConversation';
import { StateType } from '../reducer';

import { getQuery, getSearchResults, isSearching } from '../selectors/search';
import {
  getIntl,
  getIsSecondaryDevice,
  getRegionCode,
  getUserNumber,
} from '../selectors/user';



const mapStateToProps = (state: StateType) => {
  //const conversationInfo = getSessionConversationInfo(state);

  // console.log(`[vince] stateToProps from SessionConversation:`, conversationInfo);
  // console.log(`[vince] stateToProps from SessionConversation:`, state);

  // You only want to rerender SessionConversation if the CURRENT conversation updates
  // Use SelectedConversationChangedActionType FROM actions.ts

  return {
    conversations: state.conversations,
  }
};

const smart = connect(mapStateToProps, mapDispatchToProps);
export const SmartSessionConversation = smart(SessionConversation);
