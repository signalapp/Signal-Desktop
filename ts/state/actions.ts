import { bindActionCreators, Dispatch } from 'redux';

import { actions as search } from './ducks/search';
import { actions as conversations } from './ducks/conversations';
import { actions as user } from './ducks/user';
import { actions as sections } from './ducks/section';
import { actions as messages } from './ducks/messages';

const actions = {
  ...search,
  ...conversations,
  ...user,
  ...messages,
  ...sections,
};

export function mapDispatchToProps(dispatch: Dispatch): Object {
  return { ...bindActionCreators(actions, dispatch) };
}
