import {IStorageManager, StorageObject} from "@atomiqlabs/base";
import {IKeyValueStorage} from "./IKeyValueStorage";

/**
 * Simple `IStorageManager` adapter built on top of any `IKeyValueStorage` backend.
 *
 * This is intended for chain-storage style data where values are accessed by id and no in-memory indexes are required.
 */
export class KeyValueStorageManager<T extends StorageObject = StorageObject> implements IStorageManager<T> {

    storageBackend: IKeyValueStorage<boolean>;

    data: {
        [hash: string]: T
    } = {};

    saveDataArr?: (values: { id: string; object: T }[]) => Promise<void>;
    removeDataArr?: (keys: string[]) => Promise<void>;

    constructor(storageBackend: IKeyValueStorage<boolean>) {
        this.storageBackend = storageBackend;

        if(this.storageBackend.setAll) {
            this.saveDataArr = async (values: { id: string; object: T }[]) => {
                if(this.storageBackend.setAll==null) return;
                await this.storageBackend.setAll(values.map(value => ({key: value.id, value: JSON.stringify(value.object.serialize())})));
                values.forEach(value => {
                    this.data[value.id] = value.object;
                });
            };
        }
        if(this.storageBackend.removeAll) {
            this.removeDataArr = async (keys: string[]) => {
                if(this.storageBackend.removeAll==null) return;
                await this.storageBackend.removeAll(keys);
                keys.forEach(key => {
                    delete this.data[key];
                });
            };
        }
    }

    async init(): Promise<void> {
        await this.storageBackend.init();
    }

    async saveData(hash: string, object: T): Promise<void> {
        await this.storageBackend.set(hash, JSON.stringify(object.serialize()));
        this.data[hash] = object;
    }

    async removeData(hash: string): Promise<void> {
        await this.storageBackend.remove(hash);
        delete this.data[hash];
    }

    async loadData(type: new (data: any) => T): Promise<T[]> {
        this.data = {};

        const result: T[] = [];

        const hashes = await this.storageBackend.getKeys();
        if(this.storageBackend.getAll!=null) {
            const rawValues = await this.storageBackend.getAll(hashes);
            rawValues.forEach((rawValue, index) => {
                if(rawValue==null) return;
                const hash = hashes[index];
                result.push(this.data[hash] = new type(JSON.parse(rawValue)));
            });
        } else {
            for(let hash of hashes) {
                const rawValue = await this.storageBackend.get(hash);
                if(rawValue==null) continue;
                result.push(this.data[hash] = new type(JSON.parse(rawValue)));
            }
        }

        return result;
    }

}
