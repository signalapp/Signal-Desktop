export const show = (element: HTMLElement): void => {
  const container: HTMLDivElement | null = document.querySelector(
    '.lightbox-container'
  );
  if (!container) {
    throw new TypeError("'.lightbox-container' is required");
  }
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
  container.innerHTML = '';
  container.style.display = 'none';
};
