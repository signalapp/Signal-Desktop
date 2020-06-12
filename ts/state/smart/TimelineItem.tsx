import { connect } from 'react-redux';

import { mapDispatchToProps } from '../actions';
import { StateType } from '../reducer';

import { TimelineItem } from '../../components/conversation/TimelineItem';
import { getIntl } from '../selectors/user';
import {
  getMessageSelector,
  getSelectedMessage,
} from '../selectors/conversations';

type ExternalProps = {
  id: string;
  conversationId: string;
  context?: {
    beforeId?: string;
    afterId?: string;
  };
};

const mapStateToProps = (state: StateType, props: ExternalProps) => {
  const { id, context, conversationId } = props;

  const messageSelector = getMessageSelector(state);
  const item = messageSelector(id);
  const before =
    context && context.beforeId ? messageSelector(context.beforeId) : undefined;
  const after =
    context && context.afterId ? messageSelector(context.afterId) : undefined;

  const selectedMessage = getSelectedMessage(state);
  const isSelected = Boolean(selectedMessage && id === selectedMessage.id);

  return {
    item,
    id,
    conversationId,
    context: {
      before,
      after,
    },
    isSelected,
    i18n: getIntl(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartTimelineItem = smart(TimelineItem);
