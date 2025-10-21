export interface IKeyValueStorage<Async extends boolean> {
    async: Async;
    init(): Promise<void>;
    get(key: string): Async extends true ? Promise<string> : string;
    set(key: string, value: string): Async extends true ? Promise<void> : void;
    remove(key: string): Async extends true ? Promise<void> : void;
    getKeys(): Async extends true ? Promise<string[]> : string[];
    getAll?(keys: string[]): Async extends true ? Promise<(string | null)[]> : (string | null)[];
    setAll?(values: {
        key: string;
        value: string;
    }[]): Async extends true ? Promise<void> : void;
    removeAll?(keys: string[]): Async extends true ? Promise<void> : void;
}
