/**
 * Generic key-value storage interface supporting both synchronous and asynchronous backends.
 * Implement this interface to create custom storage backends for MemoryIndexedKeyValueUnifiedStorage.
 *
 * @typeParam Async - When true, all operations return Promises; when false, operations are synchronous
 */
export interface IKeyValueStorage<Async extends boolean> {
    /** Whether this storage backend is asynchronous */
    async: Async;
    /** Initializes the storage backend */
    init(): Promise<void>;
    /**
     * Retrieves a value by key
     * @param key - The key to look up
     * @returns The stored value, or null if not found
     */
    get(key: string): Async extends true ? Promise<string | null> : (string | null);
    /**
     * Stores a value at the given key
     * @param key - The key to store under
     * @param value - The string value to store
     */
    set(key: string, value: string): Async extends true ? Promise<void> : void;
    /**
     * Removes a value by key
     * @param key - The key to remove
     */
    remove(key: string): Async extends true ? Promise<void> : void;
    /**
     * Returns all keys in the storage
     * @returns Array of all stored keys
     */
    getKeys(): Async extends true ? Promise<string[]> : string[];
    /**
     * Retrieves multiple values by keys (optional batch operation)
     * @param keys - Array of keys to look up
     * @returns Array of values in the same order as keys, null for missing keys
     */
    getAll?(keys: string[]): Async extends true ? Promise<(string | null)[]> : (string | null)[];
    /**
     * Stores multiple key-value pairs (optional batch operation)
     * @param values - Array of key-value pairs to store
     */
    setAll?(values: {
        key: string;
        value: string;
    }[]): Async extends true ? Promise<void> : void;
    /**
     * Removes multiple values by keys (optional batch operation)
     * @param keys - Array of keys to remove
     */
    removeAll?(keys: string[]): Async extends true ? Promise<void> : void;
}
