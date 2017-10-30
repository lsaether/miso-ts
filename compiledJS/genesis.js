"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const blockchain_1 = require("./blockchain");
exports.genesisBlock = () => {
    return new blockchain_1.Block(0, '0', new Date().getTime() / 1000, 'Insert time relevant information here', '4ef5423cd00dd7ef78827570902d09a77b88d282ea79991f058c17c9eeb774aebaf192ecdbe0d96b8f345b03e55e52454223c6b0a02cc21467c357dd8a3e7051');
};
