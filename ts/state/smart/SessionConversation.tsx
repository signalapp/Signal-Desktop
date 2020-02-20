import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { SessionConversation } from '../../components/session/SessionConversation';
import { StateType } from '../reducer';

import { getLeftPaneLists } from '../selectors/conversations';

const mapStateToProps = (state: StateType) => {
  const lists = getLeftPaneLists(state);

  return lists;
};

const smart = connect(mapStateToProps, mapDispatchToProps);
export const SmartSessionConversation = smart(SessionConversation);
