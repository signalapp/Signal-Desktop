import { connect } from 'react-redux';

import { mapDispatchToProps } from '../actions';
import { StateType } from '../reducer';

import { MessageSearchResult } from '../../components/MessageSearchResult';
import { getIntl } from '../selectors/user';
import { getMessageSearchResultSelector } from '../selectors/search';

type SmartProps = {
  id: string;
};

function mapStateToProps(state: StateType, ourProps: SmartProps) {
  const { id } = ourProps;

  const props = getMessageSearchResultSelector(state)(id);

  return {
    ...props,
    i18n: getIntl(state),
  };
}
const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartMessageSearchResult = smart(MessageSearchResult);
