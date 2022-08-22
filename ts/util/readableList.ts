export const readableList = (
  arr: Array<string>,
  conjunction: string = '&',
  limit: number = 3
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
        if (others === 0 && i === count - 1 && i < limit) {
          result += ` ${conjunction} `;
        } else if (i !== 0 && i < limit) {
          result += ', ';
        } else if (i >= limit) {
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
