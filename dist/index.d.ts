/**
 * # @atomiqlabs/storage-memory-indexed-kv
 *
 * `@atomiqlabs/storage-memory-indexed-kv` provides key-value-backed storage adapters for the Atomiq SDK.
 *
 * - swaps are persisted as plain key-value records in your backend
 * - during `init()`, the adapter reads the stored swaps and rebuilds the required simple and composite indexes in memory
 * - queries are then served from those in-memory indexes
 * - writes are serialized through a single write queue and update both the backend and the in-memory indexes
 *
 * Because the indexes live in RAM, this adapter is intended for single-user, client-side datasets. In practice this means it is suitable for swap stores with fewer than roughly `10,000` saved swaps.
 *
 *
 * ## What this package provides
 *
 * - `MemoryIndexedKeyValueUnifiedStorage`: SDK-compatible unified swap storage built on top of any key-value backend that implements `IKeyValueStorage`.
 * - `KeyValueStorageManager`: simple `IStorageManager` adapter for chain storage built on top of `IKeyValueStorage`.
 * - `IKeyValueStorage<Async>`: the backend interface you implement for your own persistent key-value store.
 *
 * ## When to use
 *
 * Use this package when you:
 *
 * - want to plug the Atomiq SDK into a custom persistent key-value store
 * - are storing swaps for a single client or device
 * - expect a relatively small local swap history
 * - need a lightweight adapter for browser-like, mobile, or embedded client environments
 *
 * Do not use this package for:
 *
 * - backend services with many users
 * - shared databases
 * - long-lived services where swap counts can grow large
 * - environments where multiple processes need to coordinate on the same storage
 *
 * For backend-scale storage, prefer `@atomiqlabs/storage-sqlite` or another adapter with database-native indexing.
 *
 * ## Installation
 *
 * ```bash
 * npm install @atomiqlabs/sdk @atomiqlabs/base @atomiqlabs/storage-memory-indexed-kv
 * ```
 *
 * Most applications should not need this package directly unless they are implementing a custom storage backend.
 *
 * ## How to use
 *
 * ### Implement `IKeyValueStorage`
 *
 * Wrap your storage backend with the `IKeyValueStorage` interface:
 *
 * ```typescript
 * export interface IKeyValueStorage<Async extends boolean> {
 *     async: Async;
 *
 *     init(): Promise<void>;
 *
 *     get(key: string): Async extends true ? Promise<string | null> : (string | null);
 *     set(key: string, value: string): Async extends true ? Promise<void> : void;
 *     remove(key: string): Async extends true ? Promise<void> : void;
 *     getKeys(): Async extends true ? Promise<string[]> : string[];
 *
 *     //Batch methods are optional, but implementing them is recommended because they reduce read and write overhead.
 *     getAll?(keys: string[]): Async extends true ? Promise<(string | null)[]> : (string | null)[];
 *     setAll?(values: { key: string, value: string }[]): Async extends true ? Promise<void> : void;
 *     removeAll?(keys: string[]): Async extends true ? Promise<void> : void;
 * }
 * ```
 *
 * The interface supports both synchronous and asynchronous storage backends, hence the `Async` generic.
 *
 * ### Example custom backend
 *
 * ```typescript
 * import {
 *     IKeyValueStorage,
 *     KeyValueStorageManager,
 *     MemoryIndexedKeyValueUnifiedStorage
 * } from "@atomiqlabs/storage-memory-indexed-kv";
 *
 * class MyKeyValueStorage implements IKeyValueStorage<true> {
 *     readonly async = true as const;
 *
 *     constructor(private readonly prefix: string) {}
 *
 *     async init(): Promise<void> {
 *         // Initialize your backend if needed.
 *     }
 *
 *     async get(key: string): Promise<string | null> {
 *         return myKeyValueBackend.get(this.prefix + key);
 *     }
 *
 *     async set(key: string, value: string): Promise<void> {
 *         await myKeyValueBackend.set(this.prefix + key, value);
 *     }
 *
 *     async remove(key: string): Promise<void> {
 *         await myKeyValueBackend.remove(this.prefix + key);
 *     }
 *
 *     async getKeys(): Promise<string[]> {
 *         const keys = await myKeyValueBackend.getKeysWithPrefix(this.prefix);
 *         return keys.map(key => key.substring(this.prefix.length));
 *     }
 *
 *     async getAll(keys: string[]): Promise<(string | null)[]> {
 *         return Promise.all(keys.map(key => this.get(key)));
 *     }
 *
 *     async setAll(values: { key: string; value: string }[]): Promise<void> {
 *         await Promise.all(values.map(value => this.set(value.key, value.value)));
 *     }
 *
 *     async removeAll(keys: string[]): Promise<void> {
 *         await Promise.all(keys.map(key => this.remove(key)));
 *     }
 * }
 *
 * const swapStorage = new MemoryIndexedKeyValueUnifiedStorage(
 *     new MyKeyValueStorage("atomiq_sdk_chain_SOLANA_")
 * );
 * const storageManager = new KeyValueStorageManager(
 *     new MyKeyValueStorage(`atomiq_sdk_store_SOLANA_`)
 * );
 * ```
 *
 * ### SDK Usage
 *
 * Use your custom storage as the SDK's `swapStorage`:
 *
 * ```typescript
 * import {BitcoinNetwork, SwapperFactory, TypedSwapper} from "@atomiqlabs/sdk";
 * import {MemoryIndexedKeyValueUnifiedStorage} from "@atomiqlabs/storage-memory-indexed-kv";
 *
 * const chains = [SolanaInitializer] as const;
 * type SupportedChains = typeof chains;
 *
 * const Factory = new SwapperFactory<SupportedChains>(chains);
 *
 * const swapper: TypedSwapper<SupportedChains> = Factory.newSwapper({
 *     chains: {
 *         ...
 *     },
 *     bitcoinNetwork: BitcoinNetwork.MAINNET,
 *     swapStorage: chainId => new MemoryIndexedKeyValueUnifiedStorage(
 *         new MyKeyValueStorage(`atomiq_sdk_chain_${chainId}_`)
 *     ),
 *     chainStorageCtor: name => new KeyValueStorageManager(
 *         new MyKeyValueStorage(`atomiq_sdk_store_${name}_`)
 *     )
 * });
 *
 * await swapper.init();
 * ```
 *
 * ## Options
 *
 * `MemoryIndexedKeyValueUnifiedStorage` accepts optional configuration:
 *
 * - `maxBatchItems`: maximum number of items processed per batch during initialization, reads, and bulk writes. Default: `100`.
 * - `allowQueryWithoutIndexes`: allows fallback full-scan queries when no configured index matches. Default: `false`.
 *
 * Leaving `allowQueryWithoutIndexes` disabled is usually the right choice, because full scans negate the point of the in-memory index model and can become expensive as the stored swap count grows.
 *
 * @packageDocumentation
 */
export * from "./MemoryIndexedKeyValueUnifiedStorage";
export * from "./KeyValueStorageManager";
export * from "./IKeyValueStorage";
