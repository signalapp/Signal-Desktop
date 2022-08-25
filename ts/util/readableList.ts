// we need to use a character that cannot be used as a display name for string manipulation up until we render the UI
export const defaultConjunction = '\uFFD7';
export const defaultWordLimit = 3;

export const readableList = (
  arr: Array<string>,
  conjunction: string = defaultConjunction,
  wordLimit: number = defaultWordLimit
): string => {
  if (arr.length === 0) {
    return '';
  }

  const count = arr.length;
  switch (count) {
    case 1:
      return arr[0];
    default:
      let result = '';
      let others = 0;
      for (let i = 0; i < count; i++) {
        if (others === 0 && i === count - 1 && i < wordLimit) {
          result += ` ${conjunction} `;
        } else if (i !== 0 && i < wordLimit) {
          result += ', ';
        } else if (i >= wordLimit) {
          others++;
        }

        if (others === 0) {
          result += arr[i];
        }
      }

      if (others > 0) {
        result += ` ${conjunction} ${others} ${
          others > 1
            ? window.i18n('readableListCounterPlural')
            : window.i18n('readableListCounterSingular')
        }`;
      }

      return result;
  }
};
