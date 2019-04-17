import { bindActionCreators, Dispatch } from 'redux';

import { actions as search } from './ducks/search';
import { actions as conversations } from './ducks/conversations';
import { actions as user } from './ducks/user';

const actions = {
  ...search,
  ...conversations,
  ...user,
};

export function mapDispatchToProps(dispatch: Dispatch): Object {
  return bindActionCreators(actions, dispatch);
}
