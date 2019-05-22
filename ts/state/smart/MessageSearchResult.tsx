import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';

import { StateType } from '../reducer';

import { MessageSearchResult } from '../../components/MessageSearchResult';

type SmartProps = {
  id: string;
};

function mapStateToProps(state: StateType, ourProps: SmartProps) {
  const { id } = ourProps;
  const lookup = state.search && state.search.messageLookup;
  if (!lookup) {
    return null;
  }

  return lookup[id];
}
const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartMessageSearchResult = smart(MessageSearchResult);
