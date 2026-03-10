"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * # @atomiqlabs/storage-memory-indexed-kv
 *
 * `@atomiqlabs/storage-memory-indexed-kv` is the generic key-value-backed unified swap storage layer for the Atomiq SDK.
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
 * - `IKeyValueStorage<Async>`: the backend interface you implement for your own persistent key-value store.
 *
 * This package handles the SDK's `swapStorage` layer only. It does not implement `chainStorageCtor` or a general chain storage manager, which anyway uses a simple key-value store and doesn't require any indexes.
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
 * const storage = new MemoryIndexedKeyValueUnifiedStorage(
 *     new MyKeyValueStorage("atomiq_sdk_chain_SOLANA_")
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
 *     bitcoinNetwork: BitcoinNetwork.TESTNET,
 *     swapStorage: chainId => new MemoryIndexedKeyValueUnifiedStorage(
 *         new MyKeyValueStorage(`atomiq_sdk_chain_${chainId}_`)
 *     )
 * });
 *
 * await swapper.init();
 * ```
 *
 * If your environment also needs a custom `chainStorageCtor`, provide that separately. This package only covers the unified swap storage layer.
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
__exportStar(require("./MemoryIndexedKeyValueUnifiedStorage"), exports);
__exportStar(require("./IKeyValueStorage"), exports);
