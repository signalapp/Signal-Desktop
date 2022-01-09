export const toLogFormat = (error: any) => {
  if (!error) {
    return error;
  }

  if (error && error.stack) {
    return error.stack;
  }

  return error.toString();
};
