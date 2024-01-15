import NodePersist from 'node-persist';

export class Persist {
  private readonly storage: NodePersist.LocalStorage;

  constructor(directoryPath: string) {
    this.storage = NodePersist.create({ dir: directoryPath });
  }

  public async init(): Promise<void> {
    await this.storage.init();
  }

  public async get<T>(
    key: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options: { deserialize?: (json: any) => T } = {},
  ): Promise<T | undefined> {
    const value = await this.storage.getItem(key);
    if (value === undefined) {
      return undefined;
    }

    const { deserialize } = options;
    return deserialize ? deserialize(value) : value as T;
  }

  public async set<T>(
    key: string,
    value: T,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options: { serialize?: (value: T) => any } = {},
  ): Promise<void> {
    const { serialize } = options;

    await this.storage.setItem(key, serialize ? serialize(value) : value);
  }

  public async clear(): Promise<void> {
    await this.storage.clear();
  }
}
