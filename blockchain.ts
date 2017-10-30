import * as CryptoJS from 'crypto-js';

export class Block {
    private index: number;
    private previousHash: string;
    private timestamp: number;
    private data: string;
    private hash: string;

    constructor(index: number, previousHash: any, timestamp: number, data: any, hash: any) {
        this.index = index;
        this.previousHash = previousHash.toString();
        this.timestamp = timestamp;
        this.data = data;
        this.hash = hash.toString();
    }

    public getIndex(): number {
        return this.index;
    }

    public getPrevHash(): string {
        return this.previousHash;
    }

    public getTimestamp(): number {
        return this.timestamp;
    }

    public getData(): string {
        return this.data;
    }

    public getHash(): string {
        return this.hash;
    }
}

export class BlockChain {
    private chain: Block[] = [];

    constructor(genesis: Block) {
        this.chain.push(genesis);
    }

    public generateNextBlock(blockData: string): Block {
        const prevBlock: Block = this.getLatestBlock();
        const nextIndex = prevBlock.getIndex();
        const prevBlockHash = prevBlock.getHash();
        const nextTimestamp = new Date().getTime() / 1000;
        const nextHash = this.calcBlockHash(nextIndex, prevBlockHash, nextTimestamp, blockData);
        return new Block(nextIndex, prevBlockHash, nextTimestamp, blockData, nextHash);
    }

    public addBlock(block: Block): boolean {
        if (this.isValidNextBlock(block)) {
            this.chain.push(block);
            return true;
        }
        return false;
    }

    public getBlocks(): Block[] {
        return this.chain;
    }

    public getLatestBlock(): Block {
        return this.chain[this.chain.length - 1];
    }

    private isValidNextBlock(block: Block): boolean {
        const prevBlock: Block = this.getLatestBlock();
        if (prevBlock.getIndex() + 1 !== block.getIndex()) {
            throw new Error("Wrong block index!");
        }
        if (prevBlock.getHash() !== block.getPrevHash()) {
            throw new Error("Wrong previous block hash!");
        }
        if (this.calcHashForBlock(block) !== block.getHash()) {
            throw new Error("What you trying to pull buddy? Wrong block hash...")
        }
        return true;
    }

    private calcHashForBlock(block: Block): string {
        return this.calcBlockHash(block.getIndex(), block.getPrevHash(), block.getTimestamp(), block.getData());
    }

    private calcBlockHash(index: number, previousHash: string, timestamp: number, data: string): string {
        return CryptoJS.SHA3(index.toString()
                                .concat(previousHash)
                                .concat(timestamp.toString())
                                .concat(data))
                                .toString();
    }
}
