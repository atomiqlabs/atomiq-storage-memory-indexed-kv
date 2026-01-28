import { IUnifiedStorage, QueryParams, UnifiedStorageCompositeIndexes, UnifiedStorageIndexes, UnifiedStoredObject } from "@atomiqlabs/sdk";
import { PromiseQueue } from "promise-queue-ts";
import { IKeyValueStorage } from "./IKeyValueStorage";
/** Configuration options for MemoryIndexedKeyValueUnifiedStorage */
export type MemoryIndexedKeyValueUnifiedStorageOptions = {
    /** Maximum number of items to process in a single batch operation (default: 100) */
    maxBatchItems?: number;
    /** Whether to allow queries that cannot use indexes (default: false) */
    allowQueryWithoutIndexes?: boolean;
};
/**
 * Unified storage wrapper that can be used on top of a simple key-value storage, this should only ever be used
 *  for a single-user swap databases (e.g. to be used on the client-side), because:
 *  - in-memory indexes are used (which can get out of hand for large datasets & don't support multi-process access)
 *  - uses a single write queue, meaning even concurrent writes are always processed sequentially
 */
export declare class MemoryIndexedKeyValueUnifiedStorage implements IUnifiedStorage<UnifiedStorageIndexes, UnifiedStorageCompositeIndexes> {
    storageBackend: IKeyValueStorage<boolean>;
    indexes?: UnifiedStorageIndexes;
    compositeIndexes?: UnifiedStorageCompositeIndexes;
    options: {
        maxBatchItems: number;
        allowQueryWithoutIndexes: boolean;
    };
    indexesMaps?: {
        [indexField: string]: Map<any, Set<string>>;
    };
    compositeIndexesMaps?: {
        [compositeIndexIdentifier: string]: Map<string, Set<string>>;
    };
    writeQueue: PromiseQueue;
    /**
     * Creates a new MemoryIndexedKeyValueUnifiedStorage instance
     * @param storageBackend - The underlying key-value storage backend
     * @param options - Configuration options
     */
    constructor(storageBackend: IKeyValueStorage<boolean>, options?: MemoryIndexedKeyValueUnifiedStorageOptions);
    protected _get(key: string): Promise<any | null> | (any | null);
    protected _getAll(keys: string[]): Promise<(any | null)[]> | (any | null)[];
    protected _set(key: string, value: any): Promise<void> | void;
    protected _setAll(values: {
        key: string;
        value: any;
        initialValue: any;
    }[]): Promise<void> | void;
    protected _removeAll(values: {
        key: string;
        initialValue: any;
    }[]): Promise<void> | void;
    protected _getAllSequential(keys: string[]): Promise<any[]>;
    protected _saveIndex(indexMap: Map<any, Set<string>>, indexValue: any, obj: any): void;
    protected _removeIndex(indexMap: Map<any, Set<string>>, indexValue: any, obj: any): void;
    protected _updateIndex(indexMap: Map<any, Set<string>>, indexOldValue: any, indexNewValue: any, obj: any): void;
    protected _saveObjectIndexes(obj: any): void;
    protected _removeObjectIndexes(obj: any): void;
    protected _updateObjectIndexes(obj: any, existingValue: any): void;
    /** @inheritDoc */
    init(indexes: UnifiedStorageIndexes, compositeIndexes: UnifiedStorageCompositeIndexes): Promise<void>;
    /** @inheritDoc */
    query(params: Array<Array<QueryParams>>): Promise<any[]>;
    /**
     * Queries storage with a single set of AND conditions
     * @param params - Array of conditions that must all be met
     * @returns Array of matching objects
     */
    querySingle(params: Array<QueryParams>): Promise<Array<UnifiedStoredObject>>;
    /** @inheritDoc */
    save(value: any): Promise<void>;
    /** @inheritDoc */
    saveAll(_values: any[]): Promise<void>;
    /** @inheritDoc */
    remove(value: any): Promise<void>;
    /** @inheritDoc */
    removeAll(_values: any[]): Promise<void>;
}
