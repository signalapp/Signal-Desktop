export const delay = (ms: number): Promise<void> =>
  new Promise(accept => {
    const timer = setTimeout(() => {
      clearTimeout(timer);
      accept();
    }, ms);
  });
