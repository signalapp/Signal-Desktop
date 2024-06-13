import useKey, { Handler, KeyPredicate, UseKeyOptions } from 'react-use/lib/useKey';

function specialKeyPressed(event: KeyboardEvent) {
  const pressed = [];

  if (event.metaKey) {
    pressed.push('super');
  }
  if (event.ctrlKey) {
    pressed.push('ctrl');
  }
  if (event.altKey) {
    pressed.push('alt');
  }
  if (event.shiftKey) {
    pressed.push('shift');
  }

  return pressed.join(' + ');
}

export function useHotkey(
  key: string,
  onPress: (event: KeyboardEvent) => void | Promise<void>,
  disabled?: boolean
) {
  const opts: UseKeyOptions<HTMLElement> = {};

  const predicate: KeyPredicate = event => {
    const lowerKey = key.toLowerCase();
    const eventKey = event.key.toLowerCase();

    switch (lowerKey) {
      case 'esc':
      case 'escape':
        return eventKey === 'escape' || eventKey === 'esc';
      default:
        return eventKey === lowerKey;
    }
  };

  const handler: Handler = event => {
    if (disabled) {
      return;
    }

    const specialKeys = specialKeyPressed(event);

    if (specialKeys) {
      return;
    }

    void onPress(event);
  };

  useKey(predicate, handler, opts);
}
