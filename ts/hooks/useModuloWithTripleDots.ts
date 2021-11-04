import { useModulo } from './useModulo';

export function useModuloWithTripleDots(
  localizedString: string,
  loopBackAt: number,
  delay: number
) {
  const modulo = useModulo(loopBackAt, delay);

  if (localizedString.endsWith('...')) {
    return localizedString.slice(0, localizedString.length - (loopBackAt - modulo.count));
  }
  return localizedString;
}
