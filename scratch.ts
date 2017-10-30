import * as CryptoJS from 'crypto-js';

const calcBlockHash = (index: number, previousHash: string, timestamp: number, data: string): string => {
    return CryptoJS.SHA3(index.toString()
                            .concat(previousHash)
                            .concat(timestamp.toString())
                            .concat(data))
                            .toString();
}

console.log(calcBlockHash(0, '0', (new Date().getTime() / 1000), 'Insert time relevant information here'));
