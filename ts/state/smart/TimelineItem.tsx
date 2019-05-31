import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { TimelineItem } from '../../components/conversation/TimelineItem';
import { StateType } from '../reducer';

import { getIntl } from '../selectors/user';
import { getMessageSelector } from '../selectors/conversations';

type ExternalProps = {
  id: string;
};

const mapStateToProps = (state: StateType, props: ExternalProps) => {
  const { id } = props;

  const messageSelector = getMessageSelector(state);

  return {
    ...messageSelector(id),
    i18n: getIntl(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartTimelineItem = smart(TimelineItem);
