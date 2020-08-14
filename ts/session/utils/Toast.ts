export function push(options: {
  title: string;
  id?: string;
  description?: string;
  type?: 'success' | 'info' | 'warning' | 'error';
  icon?: string;
  shouldFade?: boolean;
}) {
  window.pushToast(options);
}
