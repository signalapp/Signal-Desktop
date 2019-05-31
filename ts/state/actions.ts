import { actions as conversations } from './ducks/conversations';
import { actions as emojis } from './ducks/emojis';
import { actions as items } from './ducks/items';
import { actions as search } from './ducks/search';
import { actions as stickers } from './ducks/stickers';
import { actions as user } from './ducks/user';

export const mapDispatchToProps = {
  ...conversations,
  ...emojis,
  ...items,
  ...search,
  ...stickers,
  ...user,
};
