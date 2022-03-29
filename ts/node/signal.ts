// The idea with this file is to make it webpackable for the style guide

import * as Data from '../../ts/data/data';
import * as Util from '../../ts/util';

export const setupSignal = () => {
  Data.init();

  return {
    Util,
  };
};
