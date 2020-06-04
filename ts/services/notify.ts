function filter(text: string) {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

type NotificationType = {
  platform: string;
  icon: string;
  message: string;
  onNotificationClick: () => void;
  silent: boolean;
  title: string;
};

export function notify({
  platform,
  icon,
  message,
  onNotificationClick,
  silent,
  title,
}: NotificationType): Notification {
  const notification = new window.Notification(title, {
    body: platform === 'linux' ? filter(message) : message,
    icon,
    silent,
  });
  notification.onclick = onNotificationClick;
  return notification;
}
