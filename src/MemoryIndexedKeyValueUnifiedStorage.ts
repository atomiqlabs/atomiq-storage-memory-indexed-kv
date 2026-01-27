import {
    IUnifiedStorage,
    QueryParams,
    UnifiedStorageCompositeIndexes,
    UnifiedStorageIndexes,
    UnifiedStoredObject
} from "@atomiqlabs/sdk-lib";
import {PromiseQueue} from "promise-queue-ts";
import {IKeyValueStorage} from "./IKeyValueStorage";

/** Configuration options for MemoryIndexedKeyValueUnifiedStorage */
export type MemoryIndexedKeyValueUnifiedStorageOptions = {
    /** Maximum number of items to process in a single batch operation (default: 100) */
    maxBatchItems?: number;
    /** Whether to allow queries that cannot use indexes (default: false) */
    allowQueryWithoutIndexes?: boolean;
};

function toCompositeIndexIdentifier(keys: readonly string[]) {
    return keys.join(",");
}

function toCompositeIndexValueArr(values: any[]): string {
    return values.map(value => toIndexValueString(value))
        .join(",");
}

function toCompositeIndexValue(keys: readonly string[], obj: any): string {
    return keys
        .map(key => toIndexValueString(obj[key]))
        .join(",");
}

function toIndexValueString(value: any): string {
    if(value==null) return "NULL";
    return value.toString(10);
}

function toIndexValue(value: any): any {
    return value==null ? null : value;
}

type QuerySetCondition = {
    key: string,
    values: Set<any>
}

function matches(conditions: Array<QuerySetCondition>, obj: any): boolean {
    for(let condition of conditions) {
        let value = obj[condition.key];
        if(!condition.values.has(value)) return false;
    }
    return true;
}

function toSetConditions(input: Array<QueryParams>): Array<QuerySetCondition>  {
    return input.map(val => {
        return {
            key: val.key,
            values: Array.isArray(val.value) ? new Set(val.value) : new Set([val.value])
        };
    })
}

function toCompositeIndex(values: Array<any[]>): Array<any[]> {
    if(values.length===0) return [];
    if(values.length===1) {
        return values[0];
    } else {
        const compositeArray: Array<any[]> = [];
        const firstValues = values.shift();
        const restValues = toCompositeIndex(values);
        for(let value of firstValues) {
            for(let restValue of restValues) {
                compositeArray.push([value].concat(restValue));
            }
        }
        return compositeArray;
    }
}

/**
 * Unified storage wrapper that can be used on top of a simple key-value storage, this should only ever be used
 *  for a single-user swap databases (e.g. to be used on the client-side), because:
 *  - in-memory indexes are used (which can get out of hand for large datasets & don't support multi-process access)
 *  - uses a single write queue, meaning even concurrent writes are always processed sequentially
 */
export class MemoryIndexedKeyValueUnifiedStorage implements IUnifiedStorage<UnifiedStorageIndexes, UnifiedStorageCompositeIndexes> {

    storageBackend: IKeyValueStorage<boolean>;
    indexes: UnifiedStorageIndexes;
    compositeIndexes: UnifiedStorageCompositeIndexes;

    options: MemoryIndexedKeyValueUnifiedStorageOptions;
    indexesMaps: {[indexField: string]: Map<any, Set<string>>};
    compositeIndexesMaps: {[compositeIndexIdentifier: string]: Map<string, Set<string>>};

    writeQueue: PromiseQueue = new PromiseQueue();

    /**
     * Creates a new MemoryIndexedKeyValueUnifiedStorage instance
     * @param storageBackend - The underlying key-value storage backend
     * @param options - Configuration options
     */
    constructor(storageBackend: IKeyValueStorage<boolean>, options?: MemoryIndexedKeyValueUnifiedStorageOptions) {
        this.storageBackend = storageBackend;
        this.options = options ?? {};
        this.options.maxBatchItems ??= 100;
    }

    protected _get(key: string): Promise<any | null> | (any | null) {
        const _existingValueStr = this.storageBackend.get(key);
        if(_existingValueStr instanceof Promise) {
            return _existingValueStr.then(str => str==null ? null : JSON.parse(str));
        } else {
            return _existingValueStr==null ? null : JSON.parse(_existingValueStr);
        }
    }

    protected _getAll(keys: string[]): Promise<(any | null)[]> | (any | null)[] {
        if(this.storageBackend.getAll!=null) {
            const result = this.storageBackend.getAll(keys);
            if(result instanceof Promise) return result.then(response => response.map(value => value==null ? null : JSON.parse(value)));
            return result.map(value => value==null ? null : JSON.parse(value));
        } else {
            //Get one by one
            const promisesOrResult = keys.map(key => this.storageBackend.get(key));
            if(promisesOrResult.length===0) return [];
            if(promisesOrResult[0] instanceof Promise) return Promise.all(promisesOrResult as Promise<string | null>[])
                .then(response => response.map(value => value==null ? null : JSON.parse(value)));
            return (promisesOrResult as (string | null)[]).map(value => value==null ? null : JSON.parse(value));
        }
    }

    protected _set(key: string, value: any): Promise<void> | void {
        return this.storageBackend.set(key, JSON.stringify(value));
    }

    protected _setAll(values: { key: string, value: any, initialValue: any }[]): Promise<void> | void {
        if(this.storageBackend.setAll!=null) {
            return this.storageBackend.setAll(values.map(val => ({key: val.key, value: JSON.stringify(val.value)})));
        } else {
            const rollbackAndThrow = (e: any) => {
                const promisesOrResult = values.map(val => {
                    if(val.initialValue==null) {
                        return this.storageBackend.remove(val.key);
                    } else {
                        return this.storageBackend.set(val.key, JSON.stringify(val.initialValue));
                    }
                });
                if(promisesOrResult.length>0 && promisesOrResult[0] instanceof Promise) {
                    return Promise.all(promisesOrResult).then(() => {
                        return Promise.reject(e);
                    });
                } else {
                    throw e;
                }
            };

            //Get one by one
            try {
                const promisesOrResult = values.map(val => this.storageBackend.set(val.key, JSON.stringify(val.value)));
                if(promisesOrResult.length===0) return;
                if(typeof(promisesOrResult[0])==="undefined") return;
                return Promise.allSettled(promisesOrResult as Promise<void>[]).then((resultArr) => {
                    for(let result of resultArr) {
                        if(result.status==="rejected") return rollbackAndThrow(result.reason);
                    }
                });
            } catch (e) {
                //Try to rollback by saving the initial values
                return rollbackAndThrow(e);
            }
        }
    }

    protected _removeAll(values: {key: string, initialValue: any}[]): Promise<void> | void {
        if(this.storageBackend.removeAll!=null) {
            return this.storageBackend.removeAll(values.map(val => val.key));
        } else {
            const rollbackAndThrow = (e: any) => {
                const promisesOrResult = values.map(val => {
                    if(val.initialValue==null) {
                        return this.storageBackend.remove(val.key);
                    } else {
                        return this.storageBackend.set(val.key, JSON.stringify(val.initialValue));
                    }
                });
                if(promisesOrResult.length>0 && promisesOrResult[0] instanceof Promise) {
                    return Promise.all(promisesOrResult).then(() => {throw e});
                } else {
                    throw e;
                }
            };

            try {
                //Get one by one
                const promisesOrResult = values.map(val => this.storageBackend.remove(val.key));
                if(promisesOrResult.length===0) return;
                if(typeof(promisesOrResult[0])==="undefined") return;
                return Promise.allSettled(promisesOrResult as Promise<void>[]).then((resultArr) => {
                    for(let result of resultArr) {
                        if(result.status==="rejected") return rollbackAndThrow(result.reason);
                    }
                });
            } catch (e) {
                return rollbackAndThrow(e);
            }
        }
    }

    protected async _getAllSequential(keys: string[]): Promise<any[]> {
        const results: any[][] = [];
        for(let i=0; i<keys.length; i+=this.options.maxBatchItems) {
            let items: any[];
            const _items = this._getAll(keys.slice(i, i+this.options.maxBatchItems));
            if(_items instanceof Promise) {
                items = await _items;
            } else {
                items = _items;
            }
            results.push(items.filter(val => val!=null));
        }

        return results.flat();
    }

    //Indexes
    protected _saveIndex(indexMap: Map<any, Set<string>>, indexValue: any, obj: any) {
        let indexSet = indexMap.get(indexValue);
        if(indexSet==null) indexMap.set(indexValue, indexSet = new Set());
        indexSet.add(obj.id);
    }

    protected _removeIndex(indexMap: Map<any, Set<string>>, indexValue: any, obj: any) {
        const indexOldSet = indexMap.get(indexValue);
        if(indexOldSet!=null) {
            indexOldSet.delete(obj.id);
            if(indexOldSet.size===0) indexMap.delete(indexValue);
        }
    }

    protected _updateIndex(indexMap: Map<any, Set<string>>, indexOldValue: any, indexNewValue: any, obj: any) {
        this._removeIndex(indexMap, indexOldValue, obj);
        this._saveIndex(indexMap, indexNewValue, obj);
    }

    protected _saveObjectIndexes(obj: any) {
        for(let index of this.indexes) {
            const indexKey = index.key;
            const indexValue = toIndexValue(obj[indexKey]);
            const indexMap = this.indexesMaps[indexKey] ??= new Map<any, Set<string>>();
            this._saveIndex(indexMap, indexValue, obj);
        }

        for(let compositeIndex of this.compositeIndexes) {
            const indexKey = toCompositeIndexIdentifier(compositeIndex.keys);
            const indexValue = toCompositeIndexValue(compositeIndex.keys, obj);
            const indexMap = this.compositeIndexesMaps[indexKey] ??= new Map<string, Set<string>>();
            this._saveIndex(indexMap, indexValue, obj);
        }
    }

    protected _removeObjectIndexes(obj: any) {
        for(let index of this.indexes) {
            const indexKey = index.key;
            const indexValue = toIndexValue(obj[indexKey]);
            const indexMap = this.indexesMaps[indexKey];
            this._removeIndex(indexMap, indexValue, obj);
        }

        for(let compositeIndex of this.compositeIndexes) {
            const indexKey = toCompositeIndexIdentifier(compositeIndex.keys);
            const indexValue = toCompositeIndexValue(compositeIndex.keys, obj);
            const indexMap = this.compositeIndexesMaps[indexKey];
            this._removeIndex(indexMap, indexValue, obj);
        }
    }

    protected _updateObjectIndexes(obj: any, existingValue: any) {
        //Check indexes changed
        for(let index of this.indexes) {
            if(obj[index.key]===existingValue[index.key]) continue; //Not changed
            const indexKey = index.key;
            const indexMap = this.indexesMaps[indexKey];
            const indexOldValue = toIndexValue(existingValue[indexKey]);
            const indexNewValue = toIndexValue(obj[indexKey]);
            this._updateIndex(indexMap, indexOldValue, indexNewValue, obj);
        }

        //Check indexes changed
        for(let compositeIndex of this.compositeIndexes) {
            const changed = compositeIndex.keys.reduce((previousValue, key) => previousValue || (obj[key]===existingValue[key]), false)
            if(!changed) continue; //Not changed
            const indexKey = toCompositeIndexIdentifier(compositeIndex.keys);
            const indexMap = this.compositeIndexesMaps[indexKey];
            const indexOldValue = toCompositeIndexValue(compositeIndex.keys, existingValue);
            const indexNewValue = toCompositeIndexValue(compositeIndex.keys, obj);
            this._updateIndex(indexMap, indexOldValue, indexNewValue, obj);
        }
    }

    /** @inheritDoc */
    async init(indexes: UnifiedStorageIndexes, compositeIndexes: UnifiedStorageCompositeIndexes): Promise<void> {
        this.indexes = indexes;
        this.compositeIndexes = compositeIndexes;

        await this.storageBackend.init();

        //Setup indexes
        this.indexesMaps = {};
        indexes.forEach(index => {
            this.indexesMaps[index.key] = new Map();
        });

        this.compositeIndexesMaps = {};
        compositeIndexes.forEach(index => {
            this.indexesMaps[toCompositeIndexIdentifier(index.keys)] = new Map();
        });

        let allKeys: string[];
        const _allKeys = this.storageBackend.getKeys();
        if(Array.isArray(_allKeys)) {
            allKeys = _allKeys;
        } else {
            allKeys = await _allKeys;
        }

        for(let i=0; i<allKeys.length; i+=this.options.maxBatchItems) {
            let loadedItems: (string | null)[];
            const _loadedItems = this._getAll(allKeys.slice(i, i+this.options.maxBatchItems));
            if(Array.isArray(_loadedItems)) {
                loadedItems = _loadedItems;
            } else {
                loadedItems = await _loadedItems;
            }

            //Save indexes
            loadedItems.forEach((obj: any | null) => {
                if(obj==null) return;
                this._saveObjectIndexes(obj);
            });
        }
    }

    /** @inheritDoc */
    async query(params: Array<Array<QueryParams>>): Promise<any[]> {
        if(params.length===0) return await this.querySingle([]);
        const results = await Promise.all(params.map(singleParam => this.querySingle(singleParam)));

        //Deduplicate
        const knownIds = new Set<string>();
        return results.flat().filter(value => {
            if(knownIds.has(value.id)) return false;
            knownIds.add(value.id);
            return true;
        });
    }

    /**
     * Queries storage with a single set of AND conditions
     * @param params - Array of conditions that must all be met
     * @returns Array of matching objects
     */
    async querySingle(params: Array<QueryParams>): Promise<Array<UnifiedStoredObject>> {
        if(params.length===0) {
            //Get all
            let keys: string[];
            const _keys = this.storageBackend.getKeys();
            if(_keys instanceof Promise) {
                keys = await _keys;
            } else {
                keys = _keys;
            }

            return await this._getAllSequential(keys);
        }

        const queryKeys = params.map(param => param.key);
        if(params.length===1) {
            //Simple indexes
            const requiredIndex = params[0].key;
            if(requiredIndex==="id") {
                //ID is the index
                const keys: any[] = Array.isArray(params[0].value) ? params[0].value : [params[0].value];
                return await this._getAllSequential(keys);
            } else {
                const indexMap = this.indexesMaps[requiredIndex];
                if(indexMap!=null) {
                    const indexValues: any[] = Array.isArray(params[0].value) ? params[0].value : [params[0].value];
                    let keys: string[] = [];
                    indexValues.forEach(indexValue => {
                        const indexSet = indexMap.get(toIndexValue(indexValue));
                        if(indexSet==null) return;
                        indexSet.forEach(key => keys.push(key));
                    });
                    const result = await this._getAllSequential(keys);
                    //Also run the final matches check on the returned items
                    const setConditions = toSetConditions(params);
                    return result.filter(val => matches(setConditions, val));
                }
            }
        } else {
            //Composite indexes
            const requiredIndex = toCompositeIndexIdentifier(queryKeys);
            const indexMap = this.compositeIndexesMaps[requiredIndex];
            if(indexMap!=null) {
                const values: Array<any[]> = params.map(param => Array.isArray(param.value) ? param.value : [param.value]);
                const compositeIndexValues = toCompositeIndex(values);
                let keys: string[] = [];
                compositeIndexValues.forEach(indexValues => {
                    const indexSet = indexMap.get(toCompositeIndexValueArr(indexValues));
                    if(indexSet==null) return [];
                    indexSet.forEach(key => keys.push(key));
                });
                const result = await this._getAllSequential(keys);
                //Also run the final matches check on the returned items
                const setConditions = toSetConditions(params);
                return result.filter(val => matches(setConditions, val));
            }
        }

        //Need to go over all values
        console.warn("query(): Index cannot be used for query, required index: "+queryKeys.join(",")+" query params: ", params);
        if(!this.options.allowQueryWithoutIndexes) throw new Error("Disallowed querying without index");

        //Get all
        let keys: string[];
        const _keys = this.storageBackend.getKeys();
        if(_keys instanceof Promise) {
            keys = await _keys;
        } else {
            keys = _keys;
        }

        const setConditions = toSetConditions(params);

        const results: any[][] = [];
        for(let i=0; i<keys.length; i+=this.options.maxBatchItems) {
            let items: any[];
            const _items = this._getAll(keys.slice(i, i+this.options.maxBatchItems));
            if(_items instanceof Promise) {
                items = await _items;
            } else {
                items = _items;
            }
            results.push(items.filter(val => val!=null && matches(setConditions, val)));
        }

        return results.flat();
    }

    /** @inheritDoc */
    save(value: any): Promise<void> {
        return this.writeQueue.enqueue(async () => {
            let existingValue: any;
            const _existingValue = this._get(value.id);
            if(_existingValue instanceof Promise) {
                existingValue = await _existingValue;
            } else {
                existingValue = _existingValue;
            }

            const result = this._set(value.id, value);
            if(result instanceof Promise) await result;

            if(existingValue!=null) {
                //Update indexes
                this._updateObjectIndexes(value, existingValue);
            } else {
                //Save new indexes
                this._saveObjectIndexes(value);
            }
        });
    }

    /** @inheritDoc */
    async saveAll(_values: any[]): Promise<void> {
        return this.writeQueue.enqueue(async () => {
            for(let e=0; e<_values.length; e+=this.options.maxBatchItems) {
                const values = _values.slice(e, e+this.options.maxBatchItems);

                let existingValues: (string | null)[];
                const _existingValues = this._getAll(values.map(val => val.id));
                if(_existingValues instanceof Promise) {
                    existingValues = await _existingValues;
                } else {
                    existingValues = _existingValues;
                }

                const result = this._setAll(values.map((val, index) => ({key: val.id, value: val, initialValue: existingValues[index]})));
                if(result instanceof Promise) await result;

                for(let i=0; i<existingValues.length; i++) {
                    const existingValue = existingValues[i];
                    const value = values[i];
                    if(existingValue!=null) {
                        //Update indexes
                        this._updateObjectIndexes(value, existingValue);
                    } else {
                        //Save new indexes
                        this._saveObjectIndexes(value);
                    }
                }
            }
        });
    }

    // async saveAll(_values: any[]): Promise<void> {
    //     // return this.writeQueue.enqueue(async () => {
    //     for(let e=0; e<_values.length; e+=this.options.maxBatchItems) {
    //         const values = _values.slice(e, e+this.options.maxBatchItems);
    //
    //         let existingValues: (any | null)[];
    //         if(this.storageBackend.async) {
    //             existingValues = await this._getAll(values.map(val => val.id));
    //             await this._setAll(values.map((val, index) => ({key: val.id, value: val, initialValue: existingValues[index]})));
    //         } else {
    //             existingValues = this._getAll(values.map(val => val.id)) as (any | null)[];
    //             this._setAll(values.map((val, index) => ({key: val.id, value: val, initialValue: existingValues[index]})));
    //         }
    //
    //         for(let i=0; i<existingValues.length; i++) {
    //             const existingValue = existingValues[i];
    //             const value = values[i];
    //             if(existingValue!=null) {
    //                 //Update indexes
    //                 this._updateObjectIndexes(value, existingValue);
    //             } else {
    //                 //Save new indexes
    //                 this._saveObjectIndexes(value);
    //             }
    //         }
    //     }
    //     // });
    // }

    /** @inheritDoc */
    remove(value: any): Promise<void> {
        return this.writeQueue.enqueue(async () => {
            let existingValue: any;
            const _existingValue = this._get(value.id);
            if(_existingValue instanceof Promise) {
                existingValue = await _existingValue;
            } else {
                existingValue = _existingValue;
            }

            const result = this.storageBackend.remove(value.id);
            if(result instanceof Promise) await result;

            if(existingValue==null) return;

            //Remove indexes
            this._removeObjectIndexes(existingValue);
        });
    }

    /** @inheritDoc */
    removeAll(_values: any[]): Promise<void> {
        return this.writeQueue.enqueue(async () => {
            for(let e=0; e<_values.length; e+=this.options.maxBatchItems) {
                const values = _values.slice(e, e+this.options.maxBatchItems);
                const valuesIds: string[] = values.map(val => val.id);

                let existingValues: (any | null)[];
                const _existingValues = this._getAll(valuesIds);
                if(_existingValues instanceof Promise) {
                    existingValues = await _existingValues;
                } else {
                    existingValues = _existingValues;
                }

                const result = this._removeAll(valuesIds.map((id, index) => ({key: id, initialValue: existingValues[index]})));
                if(result instanceof Promise) await result;

                for(let i=0; i<existingValues.length; i++) {
                    const existingValue = existingValues[i];
                    if(existingValue==null) continue;
                    this._removeObjectIndexes(existingValue);
                }
            }
        });
    }

}
