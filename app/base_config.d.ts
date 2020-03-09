export interface BaseConfig {
  set(keyPath: string, value: any): void
  get(keyPath: string): any | undefined
  remove(): void
}

interface Options {
  allowMalformedOnStartup: boolean
}

export function start(name: string, targetPath: string, options: Options): BaseConfig;
