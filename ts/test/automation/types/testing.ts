export type User = {
  userName: string;
  sessionid: string;
  recoveryPhrase: string;
};

export type Group = {
  userName: string;
  userOne: User;
  userTwo: User;
  userThree: User;
};

export type Strategy = 'data-testid' | 'class' | ':has-text';
