"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const CryptoJS = require("crypto-js");
class Block {
    constructor(index, previousHash, timestamp, data, hash) {
        this.index = index;
        this.previousHash = previousHash.toString();
        this.timestamp = timestamp;
        this.data = data;
        this.hash = hash.toString();
    }
    getIndex() {
        return this.index;
    }
    getPrevHash() {
        return this.previousHash;
    }
    getTimestamp() {
        return this.timestamp;
    }
    getData() {
        return this.data;
    }
    getHash() {
        return this.hash;
    }
}
exports.Block = Block;
class BlockChain {
    constructor(genesis) {
        this.chain = [];
        this.chain.push(genesis);
    }
    generateNextBlock(blockData) {
        const prevBlock = this.getLatestBlock();
        const nextIndex = prevBlock.getIndex() + 1;
        const prevBlockHash = prevBlock.getHash();
        const nextTimestamp = new Date().getTime() / 1000;
        const nextHash = this.calcBlockHash(nextIndex, prevBlockHash, nextTimestamp, blockData);
        return new Block(nextIndex, prevBlockHash, nextTimestamp, blockData, nextHash);
    }
    addBlock(block) {
        if (this.isValidNextBlock(block)) {
            this.chain.push(block);
            return true;
        }
        return false;
    }
    getBlocks() {
        return this.chain;
    }
    getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }
    isValidNextBlock(block) {
        const prevBlock = this.getLatestBlock();
        if (prevBlock.getIndex() + 1 !== block.getIndex()) {
            throw new Error("Wrong block index!");
        }
        if (prevBlock.getHash() !== block.getPrevHash()) {
            throw new Error("Wrong previous block hash!");
        }
        if (this.calcHashForBlock(block) !== block.getHash()) {
            throw new Error("What you trying to pull buddy? Wrong block hash...");
        }
        return true;
    }
    calcHashForBlock(block) {
        return this.calcBlockHash(block.getIndex(), block.getPrevHash(), block.getTimestamp(), block.getData());
    }
    calcBlockHash(index, previousHash, timestamp, data) {
        return CryptoJS.SHA3(index.toString()
            .concat(previousHash)
            .concat(timestamp.toString())
            .concat(data))
            .toString();
    }
}
exports.BlockChain = BlockChain;
