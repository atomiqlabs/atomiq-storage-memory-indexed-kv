import { IStorageManager, StorageObject } from "@atomiqlabs/base";
import { IKeyValueStorage } from "./IKeyValueStorage";
/**
 * Simple `IStorageManager` adapter built on top of any `IKeyValueStorage` backend.
 *
 * This is intended for chain-storage style data where values are accessed by id and no in-memory indexes are required.
 */
export declare class KeyValueStorageManager<T extends StorageObject = StorageObject> implements IStorageManager<T> {
    storageBackend: IKeyValueStorage<boolean>;
    data: {
        [hash: string]: T;
    };
    saveDataArr?: (values: {
        id: string;
        object: T;
    }[]) => Promise<void>;
    removeDataArr?: (keys: string[]) => Promise<void>;
    constructor(storageBackend: IKeyValueStorage<boolean>);
    init(): Promise<void>;
    saveData(hash: string, object: T): Promise<void>;
    removeData(hash: string): Promise<void>;
    loadData(type: new (data: any) => T): Promise<T[]>;
}
