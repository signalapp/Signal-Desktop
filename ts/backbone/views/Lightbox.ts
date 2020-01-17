export const show = (element: HTMLElement): void => {
  const container: HTMLDivElement | null = document.querySelector(
    '.lightbox-container'
  );
  if (!container) {
    throw new TypeError("'.lightbox-container' is required");
  }
  // tslint:disable-next-line:no-inner-html
  container.innerHTML = '';
  container.style.display = 'block';
  container.appendChild(element);
};

export const hide = (): void => {
  const container: HTMLDivElement | null = document.querySelector(
    '.lightbox-container'
  );
  if (!container) {
    return;
  }
  // tslint:disable-next-line:no-inner-html
  container.innerHTML = '';
  container.style.display = 'none';
};
