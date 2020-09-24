import { combineReducers, Reducer } from 'redux';
// eslint-disable-next-line import/no-cycle
import { reducer as stickers } from './ducks/stickers';

export const reducer = combineReducers({
  stickers,
});

export type AppState = typeof reducer extends Reducer<infer U> ? U : never;
