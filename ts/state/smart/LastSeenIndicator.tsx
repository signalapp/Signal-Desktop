import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';

import { LastSeenIndicator } from '../../components/conversation/LastSeenIndicator';

import { StateType } from '../reducer';
import { getIntl } from '../selectors/user';
import { getConversationMessagesSelector } from '../selectors/conversations';

type ExternalProps = {
  id: string;
};

const mapStateToProps = (state: StateType, props: ExternalProps) => {
  const { id } = props;

  const conversation = getConversationMessagesSelector(state)(id);
  if (!conversation) {
    throw new Error(`Did not find conversation ${id} in state!`);
  }

  const { totalUnread } = conversation;

  return {
    count: totalUnread,
    i18n: getIntl(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartLastSeenIndicator = smart(LastSeenIndicator);
