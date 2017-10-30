"use strict";
exports.__esModule = true;
var CryptoJS = require("crypto-js");
var calcBlockHash = function (index, previousHash, timestamp, data) {
    return CryptoJS.SHA3(index.toString()
        .concat(previousHash)
        .concat(timestamp.toString())
        .concat(data))
        .toString();
};
console.log(calcBlockHash(0, '0', (new Date().getTime() / 1000), 'Insert time relevant information here'));
