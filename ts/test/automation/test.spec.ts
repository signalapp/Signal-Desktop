import { clickOnMatchingText } from './utilities/utils';
import { sessionTestOneWindow } from './setup/sessionTest';

sessionTestOneWindow('Tiny test', async ([windowA]) => {
  await clickOnMatchingText(windowA, 'Create Session ID');
});
