"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeyValueStorageManager = void 0;
/**
 * Simple `IStorageManager` adapter built on top of any `IKeyValueStorage` backend.
 *
 * This is intended for chain-storage style data where values are accessed by id and no in-memory indexes are required.
 */
class KeyValueStorageManager {
    constructor(storageBackend) {
        this.data = {};
        this.storageBackend = storageBackend;
        if (this.storageBackend.setAll) {
            this.saveDataArr = async (values) => {
                if (this.storageBackend.setAll == null)
                    return;
                await this.storageBackend.setAll(values.map(value => ({ key: value.id, value: JSON.stringify(value.object.serialize()) })));
                values.forEach(value => {
                    this.data[value.id] = value.object;
                });
            };
        }
        if (this.storageBackend.removeAll) {
            this.removeDataArr = async (keys) => {
                if (this.storageBackend.removeAll == null)
                    return;
                await this.storageBackend.removeAll(keys);
                keys.forEach(key => {
                    delete this.data[key];
                });
            };
        }
    }
    async init() {
        await this.storageBackend.init();
    }
    async saveData(hash, object) {
        await this.storageBackend.set(hash, JSON.stringify(object.serialize()));
        this.data[hash] = object;
    }
    async removeData(hash) {
        await this.storageBackend.remove(hash);
        delete this.data[hash];
    }
    async loadData(type) {
        this.data = {};
        const result = [];
        const hashes = await this.storageBackend.getKeys();
        if (this.storageBackend.getAll != null) {
            const rawValues = await this.storageBackend.getAll(hashes);
            rawValues.forEach((rawValue, index) => {
                if (rawValue == null)
                    return;
                const hash = hashes[index];
                result.push(this.data[hash] = new type(JSON.parse(rawValue)));
            });
        }
        else {
            for (let hash of hashes) {
                const rawValue = await this.storageBackend.get(hash);
                if (rawValue == null)
                    continue;
                result.push(this.data[hash] = new type(JSON.parse(rawValue)));
            }
        }
        return result;
    }
}
exports.KeyValueStorageManager = KeyValueStorageManager;
