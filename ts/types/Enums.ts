export type PickEnum<T, K extends T> = {
  [P in keyof K]: P extends K ? P : never;
};
