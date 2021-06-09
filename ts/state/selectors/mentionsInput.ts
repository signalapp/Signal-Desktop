import { StateType } from '../reducer';

import { MentionsInputState } from '../ducks/mentionsInput';

export const getMentionsInput = (state: StateType): MentionsInputState => state.mentionsInput;
