# atomiqlabs SDK abstract memory indexed storage

Storage adapter for atomiqlabs SDK that abstracts away the indexes and allows to use any key-value backend for the actual persistency

## Usage

### Implement the IKeyValueStorage

Implement the following interface around your existing key-value backend

```typescript
export interface IKeyValueStorage<Async extends boolean> {

    async: Async;

    init(): Promise<void>;

    get(key: string): Async extends true ? Promise<string> : string;

    set(key: string, value: string): Async extends true ? Promise<void> : void;

    remove(key: string): Async extends true ? Promise<void> : void;

    getKeys(): Async extends true ? Promise<string[]> : string[];

    getAll?(keys: string[]): Async extends true ? Promise<(string | null)[]> : (string | null)[];

    setAll?(values: { key: string, value: string }[]): Async extends true ? Promise<void> : void;

    removeAll?(keys: string[]): Async extends true ? Promise<void> : void;

}
```

### Pass in the custom key-value backend in constructor

```typescript
const storage = new MemoryIndexedKeyValueUnifiedStorage(<custom implementation of IKeyValueStorage>);
```

You can also extends the `MemoryIndexedKeyValueUnifiedStorage` class and pass the custom implementation of IKeyValueStorage in the `super()` of the constructor.

