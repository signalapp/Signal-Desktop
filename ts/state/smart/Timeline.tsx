import React from 'react';
import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { Timeline } from '../../components/conversation/Timeline';
import { StateType } from '../reducer';

import { getIntl } from '../selectors/user';
import { getConversationSelector } from '../selectors/conversations';

import { SmartTimelineItem } from './TimelineItem';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363
const FilteredSmartTimelineItem = SmartTimelineItem as any;

type ExternalProps = {
  id: string;
};

const mapStateToProps = (state: StateType, props: ExternalProps) => {
  const { id } = props;

  const conversationSelector = getConversationSelector(state);
  const conversation = conversationSelector(id);
  const items: Array<string> = [];

  return {
    ...conversation,
    items,
    i18n: getIntl(state),
    renderTimelineItem: (messageId: string) => {
      return <FilteredSmartTimelineItem id={messageId} />;
    },
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartTimeline = smart(Timeline);
