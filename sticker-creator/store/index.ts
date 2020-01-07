import { createStore } from 'redux';
import { reducer } from './reducer';

import * as stickersDuck from './ducks/stickers';

export { stickersDuck };

export const store = createStore(reducer);
