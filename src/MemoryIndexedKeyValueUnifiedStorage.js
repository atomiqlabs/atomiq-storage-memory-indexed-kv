"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryIndexedKeyValueUnifiedStorage = void 0;
var promise_queue_ts_1 = require("promise-queue-ts");
function toCompositeIndexIdentifier(keys) {
    return keys.join(",");
}
function toCompositeIndexValueArr(values) {
    return values.map(function (value) { return toIndexValueString(value); })
        .join(",");
}
function toCompositeIndexValue(keys, obj) {
    return keys
        .map(function (key) { return toIndexValueString(obj[key]); })
        .join(",");
}
function toIndexValueString(value) {
    if (value == null)
        return "NULL";
    return value.toString(10);
}
function toIndexValue(value) {
    return value == null ? null : value;
}
function matches(conditions, obj) {
    for (var _i = 0, conditions_1 = conditions; _i < conditions_1.length; _i++) {
        var condition = conditions_1[_i];
        var value = obj[condition.key];
        if (!condition.values.has(value))
            return false;
    }
    return true;
}
function toSetConditions(input) {
    return input.map(function (val) {
        return {
            key: val.key,
            values: Array.isArray(val.value) ? new Set(val.value) : new Set([val.value])
        };
    });
}
function toCompositeIndex(values) {
    if (values.length === 0)
        return [];
    if (values.length === 1) {
        return values[0];
    }
    else {
        var compositeArray = [];
        var firstValues = values.shift();
        var restValues = toCompositeIndex(values);
        for (var _i = 0, firstValues_1 = firstValues; _i < firstValues_1.length; _i++) {
            var value = firstValues_1[_i];
            for (var _a = 0, restValues_1 = restValues; _a < restValues_1.length; _a++) {
                var restValue = restValues_1[_a];
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
var MemoryIndexedKeyValueUnifiedStorage = /** @class */ (function () {
    function MemoryIndexedKeyValueUnifiedStorage(storageBackend, options) {
        var _a;
        var _b;
        this.writeQueue = new promise_queue_ts_1.PromiseQueue();
        this.storageBackend = storageBackend;
        this.options = options !== null && options !== void 0 ? options : {};
        (_a = (_b = this.options).maxBatchItems) !== null && _a !== void 0 ? _a : (_b.maxBatchItems = 100);
    }
    MemoryIndexedKeyValueUnifiedStorage.prototype._get = function (key) {
        var _existingValueStr = this.storageBackend.get(key);
        if (_existingValueStr instanceof Promise) {
            return _existingValueStr.then(function (str) { return str == null ? null : JSON.parse(str); });
        }
        else {
            return _existingValueStr == null ? null : JSON.parse(_existingValueStr);
        }
    };
    MemoryIndexedKeyValueUnifiedStorage.prototype._getAll = function (keys) {
        var _this = this;
        if (this.storageBackend.getAll != null) {
            var result = this.storageBackend.getAll(keys);
            if (result instanceof Promise)
                return result.then(function (response) { return response.map(function (value) { return value == null ? null : JSON.parse(value); }); });
            return result.map(function (value) { return value == null ? null : JSON.parse(value); });
        }
        else {
            //Get one by one
            var promisesOrResult = keys.map(function (key) { return _this.storageBackend.get(key); });
            if (promisesOrResult.length === 0)
                return [];
            if (promisesOrResult[0] instanceof Promise)
                return Promise.all(promisesOrResult)
                    .then(function (response) { return response.map(function (value) { return value == null ? null : JSON.parse(value); }); });
            return promisesOrResult.map(function (value) { return value == null ? null : JSON.parse(value); });
        }
    };
    MemoryIndexedKeyValueUnifiedStorage.prototype._set = function (key, value) {
        return this.storageBackend.set(key, JSON.stringify(value));
    };
    MemoryIndexedKeyValueUnifiedStorage.prototype._setAll = function (values) {
        var _this = this;
        if (this.storageBackend.setAll != null) {
            return this.storageBackend.setAll(values.map(function (val) { return ({ key: val.key, value: JSON.stringify(val.value) }); }));
        }
        else {
            var rollbackAndThrow_1 = function (e) {
                var promisesOrResult = values.map(function (val) {
                    if (val.initialValue == null) {
                        return _this.storageBackend.remove(val.key);
                    }
                    else {
                        return _this.storageBackend.set(val.key, JSON.stringify(val.initialValue));
                    }
                });
                if (promisesOrResult.length > 0 && promisesOrResult[0] instanceof Promise) {
                    return Promise.all(promisesOrResult).then(function () {
                        return Promise.reject(e);
                    });
                }
                else {
                    throw e;
                }
            };
            //Get one by one
            try {
                var promisesOrResult = values.map(function (val) { return _this.storageBackend.set(val.key, JSON.stringify(val.value)); });
                if (promisesOrResult.length === 0)
                    return;
                if (typeof (promisesOrResult[0]) === "undefined")
                    return;
                return Promise.allSettled(promisesOrResult).then(function (resultArr) {
                    for (var _i = 0, resultArr_1 = resultArr; _i < resultArr_1.length; _i++) {
                        var result = resultArr_1[_i];
                        if (result.status === "rejected")
                            return rollbackAndThrow_1(result.reason);
                    }
                });
            }
            catch (e) {
                //Try to rollback by saving the initial values
                return rollbackAndThrow_1(e);
            }
        }
    };
    MemoryIndexedKeyValueUnifiedStorage.prototype._removeAll = function (values) {
        var _this = this;
        if (this.storageBackend.removeAll != null) {
            return this.storageBackend.removeAll(values.map(function (val) { return val.key; }));
        }
        else {
            var rollbackAndThrow_2 = function (e) {
                var promisesOrResult = values.map(function (val) {
                    if (val.initialValue == null) {
                        return _this.storageBackend.remove(val.key);
                    }
                    else {
                        return _this.storageBackend.set(val.key, JSON.stringify(val.initialValue));
                    }
                });
                if (promisesOrResult.length > 0 && promisesOrResult[0] instanceof Promise) {
                    return Promise.all(promisesOrResult).then(function () { throw e; });
                }
                else {
                    throw e;
                }
            };
            try {
                //Get one by one
                var promisesOrResult = values.map(function (val) { return _this.storageBackend.remove(val.key); });
                if (promisesOrResult.length === 0)
                    return;
                if (typeof (promisesOrResult[0]) === "undefined")
                    return;
                return Promise.allSettled(promisesOrResult).then(function (resultArr) {
                    for (var _i = 0, resultArr_2 = resultArr; _i < resultArr_2.length; _i++) {
                        var result = resultArr_2[_i];
                        if (result.status === "rejected")
                            return rollbackAndThrow_2(result.reason);
                    }
                });
            }
            catch (e) {
                return rollbackAndThrow_2(e);
            }
        }
    };
    MemoryIndexedKeyValueUnifiedStorage.prototype._getAllSequential = function (keys) {
        return __awaiter(this, void 0, void 0, function () {
            var results, i, items, _items;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        results = [];
                        i = 0;
                        _a.label = 1;
                    case 1:
                        if (!(i < keys.length)) return [3 /*break*/, 6];
                        items = void 0;
                        _items = this._getAll(keys.slice(i, i + this.options.maxBatchItems));
                        if (!(_items instanceof Promise)) return [3 /*break*/, 3];
                        return [4 /*yield*/, _items];
                    case 2:
                        items = _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        items = _items;
                        _a.label = 4;
                    case 4:
                        results.push(items.filter(function (val) { return val != null; }));
                        _a.label = 5;
                    case 5:
                        i += this.options.maxBatchItems;
                        return [3 /*break*/, 1];
                    case 6: return [2 /*return*/, results.flat()];
                }
            });
        });
    };
    //Indexes
    MemoryIndexedKeyValueUnifiedStorage.prototype._saveIndex = function (indexMap, indexValue, obj) {
        var indexSet = indexMap.get(indexValue);
        if (indexSet == null)
            indexMap.set(indexValue, indexSet = new Set());
        indexSet.add(obj.id);
    };
    MemoryIndexedKeyValueUnifiedStorage.prototype._removeIndex = function (indexMap, indexValue, obj) {
        var indexOldSet = indexMap.get(indexValue);
        if (indexOldSet != null) {
            indexOldSet.delete(obj.id);
            if (indexOldSet.size === 0)
                indexMap.delete(indexValue);
        }
    };
    MemoryIndexedKeyValueUnifiedStorage.prototype._updateIndex = function (indexMap, indexOldValue, indexNewValue, obj) {
        this._removeIndex(indexMap, indexOldValue, obj);
        this._saveIndex(indexMap, indexNewValue, obj);
    };
    MemoryIndexedKeyValueUnifiedStorage.prototype._saveObjectIndexes = function (obj) {
        var _a, _b;
        var _c, _d;
        for (var _i = 0, _e = this.indexes; _i < _e.length; _i++) {
            var index = _e[_i];
            var indexKey = index.key;
            var indexValue = toIndexValue(obj[indexKey]);
            var indexMap = (_a = (_c = this.indexesMaps)[indexKey]) !== null && _a !== void 0 ? _a : (_c[indexKey] = new Map());
            this._saveIndex(indexMap, indexValue, obj);
        }
        for (var _f = 0, _g = this.compositeIndexes; _f < _g.length; _f++) {
            var compositeIndex = _g[_f];
            var indexKey = toCompositeIndexIdentifier(compositeIndex.keys);
            var indexValue = toCompositeIndexValue(compositeIndex.keys, obj);
            var indexMap = (_b = (_d = this.compositeIndexesMaps)[indexKey]) !== null && _b !== void 0 ? _b : (_d[indexKey] = new Map());
            this._saveIndex(indexMap, indexValue, obj);
        }
    };
    MemoryIndexedKeyValueUnifiedStorage.prototype._removeObjectIndexes = function (obj) {
        for (var _i = 0, _a = this.indexes; _i < _a.length; _i++) {
            var index = _a[_i];
            var indexKey = index.key;
            var indexValue = toIndexValue(obj[indexKey]);
            var indexMap = this.indexesMaps[indexKey];
            this._removeIndex(indexMap, indexValue, obj);
        }
        for (var _b = 0, _c = this.compositeIndexes; _b < _c.length; _b++) {
            var compositeIndex = _c[_b];
            var indexKey = toCompositeIndexIdentifier(compositeIndex.keys);
            var indexValue = toCompositeIndexValue(compositeIndex.keys, obj);
            var indexMap = this.compositeIndexesMaps[indexKey];
            this._removeIndex(indexMap, indexValue, obj);
        }
    };
    MemoryIndexedKeyValueUnifiedStorage.prototype._updateObjectIndexes = function (obj, existingValue) {
        //Check indexes changed
        for (var _i = 0, _a = this.indexes; _i < _a.length; _i++) {
            var index = _a[_i];
            if (obj[index.key] === existingValue[index.key])
                continue; //Not changed
            var indexKey = index.key;
            var indexMap = this.indexesMaps[indexKey];
            var indexOldValue = toIndexValue(existingValue[indexKey]);
            var indexNewValue = toIndexValue(obj[indexKey]);
            this._updateIndex(indexMap, indexOldValue, indexNewValue, obj);
        }
        //Check indexes changed
        for (var _b = 0, _c = this.compositeIndexes; _b < _c.length; _b++) {
            var compositeIndex = _c[_b];
            var changed = compositeIndex.keys.reduce(function (previousValue, key) { return previousValue || (obj[key] === existingValue[key]); }, false);
            if (!changed)
                continue; //Not changed
            var indexKey = toCompositeIndexIdentifier(compositeIndex.keys);
            var indexMap = this.compositeIndexesMaps[indexKey];
            var indexOldValue = toCompositeIndexValue(compositeIndex.keys, existingValue);
            var indexNewValue = toCompositeIndexValue(compositeIndex.keys, obj);
            this._updateIndex(indexMap, indexOldValue, indexNewValue, obj);
        }
    };
    /**
     * Initializes the storage with given indexes and composite indexes
     * @param indexes
     * @param compositeIndexes
     */
    MemoryIndexedKeyValueUnifiedStorage.prototype.init = function (indexes, compositeIndexes) {
        return __awaiter(this, void 0, void 0, function () {
            var allKeys, _allKeys, i, loadedItems, _loadedItems;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.indexes = indexes;
                        this.compositeIndexes = compositeIndexes;
                        return [4 /*yield*/, this.storageBackend.init()];
                    case 1:
                        _a.sent();
                        //Setup indexes
                        this.indexesMaps = {};
                        indexes.forEach(function (index) {
                            _this.indexesMaps[index.key] = new Map();
                        });
                        this.compositeIndexesMaps = {};
                        compositeIndexes.forEach(function (index) {
                            _this.indexesMaps[toCompositeIndexIdentifier(index.keys)] = new Map();
                        });
                        _allKeys = this.storageBackend.getKeys();
                        if (!Array.isArray(_allKeys)) return [3 /*break*/, 2];
                        allKeys = _allKeys;
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, _allKeys];
                    case 3:
                        allKeys = _a.sent();
                        _a.label = 4;
                    case 4:
                        i = 0;
                        _a.label = 5;
                    case 5:
                        if (!(i < allKeys.length)) return [3 /*break*/, 10];
                        loadedItems = void 0;
                        _loadedItems = this._getAll(allKeys.slice(i, i + this.options.maxBatchItems));
                        if (!Array.isArray(_loadedItems)) return [3 /*break*/, 6];
                        loadedItems = _loadedItems;
                        return [3 /*break*/, 8];
                    case 6: return [4 /*yield*/, _loadedItems];
                    case 7:
                        loadedItems = _a.sent();
                        _a.label = 8;
                    case 8:
                        //Save indexes
                        loadedItems.forEach(function (obj) {
                            if (obj == null)
                                return;
                            _this._saveObjectIndexes(obj);
                        });
                        _a.label = 9;
                    case 9:
                        i += this.options.maxBatchItems;
                        return [3 /*break*/, 5];
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Params are specified in the following way:
     *  - [[condition1, condition2]] - returns all rows where condition1 AND condition2 is met
     *  - [[condition1], [condition2]] - returns all rows where condition1 OR condition2 is met
     *  - [[condition1, condition2], [condition3]] - returns all rows where (condition1 AND condition2) OR condition3 is met
     * @param params
     */
    MemoryIndexedKeyValueUnifiedStorage.prototype.query = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var results, knownIds;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(params.length === 0)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.querySingle([])];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2: return [4 /*yield*/, Promise.all(params.map(function (singleParam) { return _this.querySingle(singleParam); }))];
                    case 3:
                        results = _a.sent();
                        knownIds = new Set();
                        return [2 /*return*/, results.flat().filter(function (value) {
                                if (knownIds.has(value.id))
                                    return false;
                                knownIds.add(value.id);
                                return true;
                            })];
                }
            });
        });
    };
    MemoryIndexedKeyValueUnifiedStorage.prototype.querySingle = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var keys_1, _keys_1, queryKeys, requiredIndex, keys_2, indexMap_1, indexValues, keys_3, result, setConditions_1, requiredIndex, indexMap_2, values, compositeIndexValues, keys_4, result, setConditions_2, keys, _keys, setConditions, results, i, items, _items;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(params.length === 0)) return [3 /*break*/, 5];
                        _keys_1 = this.storageBackend.getKeys();
                        if (!(_keys_1 instanceof Promise)) return [3 /*break*/, 2];
                        return [4 /*yield*/, _keys_1];
                    case 1:
                        keys_1 = _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        keys_1 = _keys_1;
                        _a.label = 3;
                    case 3: return [4 /*yield*/, this._getAllSequential(keys_1)];
                    case 4: return [2 /*return*/, _a.sent()];
                    case 5:
                        queryKeys = params.map(function (param) { return param.key; });
                        if (!(params.length === 1)) return [3 /*break*/, 10];
                        requiredIndex = params[0].key;
                        if (!(requiredIndex === "id")) return [3 /*break*/, 7];
                        keys_2 = Array.isArray(params[0].value) ? params[0].value : [params[0].value];
                        return [4 /*yield*/, this._getAllSequential(keys_2)];
                    case 6: return [2 /*return*/, _a.sent()];
                    case 7:
                        indexMap_1 = this.indexesMaps[requiredIndex];
                        if (!(indexMap_1 != null)) return [3 /*break*/, 9];
                        indexValues = Array.isArray(params[0].value) ? params[0].value : [params[0].value];
                        keys_3 = [];
                        indexValues.forEach(function (indexValue) {
                            var indexSet = indexMap_1.get(toIndexValue(indexValue));
                            if (indexSet == null)
                                return;
                            indexSet.forEach(function (key) { return keys_3.push(key); });
                        });
                        return [4 /*yield*/, this._getAllSequential(keys_3)];
                    case 8:
                        result = _a.sent();
                        setConditions_1 = toSetConditions(params);
                        return [2 /*return*/, result.filter(function (val) { return matches(setConditions_1, val); })];
                    case 9: return [3 /*break*/, 12];
                    case 10:
                        requiredIndex = toCompositeIndexIdentifier(queryKeys);
                        indexMap_2 = this.compositeIndexesMaps[requiredIndex];
                        if (!(indexMap_2 != null)) return [3 /*break*/, 12];
                        values = params.map(function (param) { return Array.isArray(param.value) ? param.value : [param.value]; });
                        compositeIndexValues = toCompositeIndex(values);
                        keys_4 = [];
                        compositeIndexValues.forEach(function (indexValues) {
                            var indexSet = indexMap_2.get(toCompositeIndexValueArr(indexValues));
                            if (indexSet == null)
                                return [];
                            indexSet.forEach(function (key) { return keys_4.push(key); });
                        });
                        return [4 /*yield*/, this._getAllSequential(keys_4)];
                    case 11:
                        result = _a.sent();
                        setConditions_2 = toSetConditions(params);
                        return [2 /*return*/, result.filter(function (val) { return matches(setConditions_2, val); })];
                    case 12:
                        //Need to go over all values
                        console.warn("query(): Index cannot be used for query, required index: " + queryKeys.join(",") + " query params: ", params);
                        if (!this.options.allowQueryWithoutIndexes)
                            throw new Error("Disallowed querying without index");
                        _keys = this.storageBackend.getKeys();
                        if (!(_keys instanceof Promise)) return [3 /*break*/, 14];
                        return [4 /*yield*/, _keys];
                    case 13:
                        keys = _a.sent();
                        return [3 /*break*/, 15];
                    case 14:
                        keys = _keys;
                        _a.label = 15;
                    case 15:
                        setConditions = toSetConditions(params);
                        results = [];
                        i = 0;
                        _a.label = 16;
                    case 16:
                        if (!(i < keys.length)) return [3 /*break*/, 21];
                        items = void 0;
                        _items = this._getAll(keys.slice(i, i + this.options.maxBatchItems));
                        if (!(_items instanceof Promise)) return [3 /*break*/, 18];
                        return [4 /*yield*/, _items];
                    case 17:
                        items = _a.sent();
                        return [3 /*break*/, 19];
                    case 18:
                        items = _items;
                        _a.label = 19;
                    case 19:
                        results.push(items.filter(function (val) { return val != null && matches(setConditions, val); }));
                        _a.label = 20;
                    case 20:
                        i += this.options.maxBatchItems;
                        return [3 /*break*/, 16];
                    case 21: return [2 /*return*/, results.flat()];
                }
            });
        });
    };
    MemoryIndexedKeyValueUnifiedStorage.prototype.save = function (value) {
        var _this = this;
        return this.writeQueue.enqueue(function () { return __awaiter(_this, void 0, void 0, function () {
            var existingValue, _existingValue, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _existingValue = this._get(value.id);
                        if (!(_existingValue instanceof Promise)) return [3 /*break*/, 2];
                        return [4 /*yield*/, _existingValue];
                    case 1:
                        existingValue = _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        existingValue = _existingValue;
                        _a.label = 3;
                    case 3:
                        result = this._set(value.id, value);
                        if (!(result instanceof Promise)) return [3 /*break*/, 5];
                        return [4 /*yield*/, result];
                    case 4:
                        _a.sent();
                        _a.label = 5;
                    case 5:
                        if (existingValue != null) {
                            //Update indexes
                            this._updateObjectIndexes(value, existingValue);
                        }
                        else {
                            //Save new indexes
                            this._saveObjectIndexes(value);
                        }
                        return [2 /*return*/];
                }
            });
        }); });
    };
    MemoryIndexedKeyValueUnifiedStorage.prototype.saveAll = function (_values) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, this.writeQueue.enqueue(function () { return __awaiter(_this, void 0, void 0, function () {
                        var _loop_1, this_1, e;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _loop_1 = function (e) {
                                        var values, existingValues, _existingValues, result, i, existingValue, value;
                                        return __generator(this, function (_b) {
                                            switch (_b.label) {
                                                case 0:
                                                    values = _values.slice(e, e + this_1.options.maxBatchItems);
                                                    _existingValues = this_1._getAll(values.map(function (val) { return val.id; }));
                                                    if (!(_existingValues instanceof Promise)) return [3 /*break*/, 2];
                                                    return [4 /*yield*/, _existingValues];
                                                case 1:
                                                    existingValues = _b.sent();
                                                    return [3 /*break*/, 3];
                                                case 2:
                                                    existingValues = _existingValues;
                                                    _b.label = 3;
                                                case 3:
                                                    result = this_1._setAll(values.map(function (val, index) { return ({ key: val.id, value: val, initialValue: existingValues[index] }); }));
                                                    if (!(result instanceof Promise)) return [3 /*break*/, 5];
                                                    return [4 /*yield*/, result];
                                                case 4:
                                                    _b.sent();
                                                    _b.label = 5;
                                                case 5:
                                                    for (i = 0; i < existingValues.length; i++) {
                                                        existingValue = existingValues[i];
                                                        value = values[i];
                                                        if (existingValue != null) {
                                                            //Update indexes
                                                            this_1._updateObjectIndexes(value, existingValue);
                                                        }
                                                        else {
                                                            //Save new indexes
                                                            this_1._saveObjectIndexes(value);
                                                        }
                                                    }
                                                    return [2 /*return*/];
                                            }
                                        });
                                    };
                                    this_1 = this;
                                    e = 0;
                                    _a.label = 1;
                                case 1:
                                    if (!(e < _values.length)) return [3 /*break*/, 4];
                                    return [5 /*yield**/, _loop_1(e)];
                                case 2:
                                    _a.sent();
                                    _a.label = 3;
                                case 3:
                                    e += this.options.maxBatchItems;
                                    return [3 /*break*/, 1];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); })];
            });
        });
    };
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
    MemoryIndexedKeyValueUnifiedStorage.prototype.remove = function (value) {
        var _this = this;
        return this.writeQueue.enqueue(function () { return __awaiter(_this, void 0, void 0, function () {
            var existingValue, _existingValue, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _existingValue = this._get(value.id);
                        if (!(_existingValue instanceof Promise)) return [3 /*break*/, 2];
                        return [4 /*yield*/, _existingValue];
                    case 1:
                        existingValue = _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        existingValue = _existingValue;
                        _a.label = 3;
                    case 3:
                        result = this.storageBackend.remove(value.id);
                        if (!(result instanceof Promise)) return [3 /*break*/, 5];
                        return [4 /*yield*/, result];
                    case 4:
                        _a.sent();
                        _a.label = 5;
                    case 5:
                        if (existingValue == null)
                            return [2 /*return*/];
                        //Remove indexes
                        this._removeObjectIndexes(existingValue);
                        return [2 /*return*/];
                }
            });
        }); });
    };
    MemoryIndexedKeyValueUnifiedStorage.prototype.removeAll = function (_values) {
        var _this = this;
        return this.writeQueue.enqueue(function () { return __awaiter(_this, void 0, void 0, function () {
            var _loop_2, this_2, e;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _loop_2 = function (e) {
                            var values, valuesIds, existingValues, _existingValues, result, i, existingValue;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        values = _values.slice(e, e + this_2.options.maxBatchItems);
                                        valuesIds = values.map(function (val) { return val.id; });
                                        _existingValues = this_2._getAll(valuesIds);
                                        if (!(_existingValues instanceof Promise)) return [3 /*break*/, 2];
                                        return [4 /*yield*/, _existingValues];
                                    case 1:
                                        existingValues = _b.sent();
                                        return [3 /*break*/, 3];
                                    case 2:
                                        existingValues = _existingValues;
                                        _b.label = 3;
                                    case 3:
                                        result = this_2._removeAll(valuesIds.map(function (id, index) { return ({ key: id, initialValue: existingValues[index] }); }));
                                        if (!(result instanceof Promise)) return [3 /*break*/, 5];
                                        return [4 /*yield*/, result];
                                    case 4:
                                        _b.sent();
                                        _b.label = 5;
                                    case 5:
                                        for (i = 0; i < existingValues.length; i++) {
                                            existingValue = existingValues[i];
                                            if (existingValue == null)
                                                continue;
                                            this_2._removeObjectIndexes(existingValue);
                                        }
                                        return [2 /*return*/];
                                }
                            });
                        };
                        this_2 = this;
                        e = 0;
                        _a.label = 1;
                    case 1:
                        if (!(e < _values.length)) return [3 /*break*/, 4];
                        return [5 /*yield**/, _loop_2(e)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        e += this.options.maxBatchItems;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        }); });
    };
    return MemoryIndexedKeyValueUnifiedStorage;
}());
exports.MemoryIndexedKeyValueUnifiedStorage = MemoryIndexedKeyValueUnifiedStorage;
