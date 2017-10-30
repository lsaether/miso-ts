import * as bodyParser from 'body-parser';
import * as express from 'express';
import * as WebSocket from 'ws';

import { Block, BlockChain } from './blockchain';
import { genesisBlock } from './genesis';

interface ResponseMessage {
    type: number,
    data: string,
}

interface WebSocketHack extends WebSocket {
    _socket: {
        remoteAddress: any,
        remotePort: any,
    },
}

const httpPort = process.env.HTTP_PORT || 6973;
const p2pPort = process.env.P2P_PORT || 6974;
const initialPeers = process.env.PEERS ? process.env.PEERS!.split('.') : [];

const sockets: WebSocketHack[] = [];
const messageType = {
    QUERY_LATEST: 0,
    QUERY_ALL: 1,
    RESPONSE_BLOCKCHAIN: 2,
};

let blockchain: BlockChain =  new BlockChain(genesisBlock());

export const initHttpServer = () => {
    const app = express();
    app.use(bodyParser.json());

    app.get('/blocks', (req, res) => {
        res.send(JSON.stringify(blockchain.getBlocks()));
    });

    app.post('/mineBlock', (req, res) => {
        const nextBlock: Block = blockchain.generateNextBlock(req.body.data);
        blockchain.addBlock(nextBlock);
        broadcast(responseLatestMsg());
        console.log(`block added ${ JSON.stringify(nextBlock) }`);
        res.send();
    });

    app.get('/peers', (req, res) => {
        res.send(sockets.map(s => s._socket.remoteAddress + ':' + s._socket.remotePort));
    });

    app.post('/addPeer', (req, res) => {
        connectToPeers([req.body.peer]);
        res.send();
    })

    app.listen(httpPort, () => console.log(`Listening on port: ${httpPort}`));
}

export class P2PServer {
    private _p2pPort: number;
    private _sockets: WebSocketHack[];

    constructor(p2pPort: number) {
        this._p2pPort = p2pPort;
    }

    init() {
        const server = new WebSocket.Server({port: this._p2pPort});
        server.on('connection', (ws: WebSocket) => this.makeConnection(ws));
        console.log(`listening websocket p2p port on: ${this._p2pPort}`);
    }

    makeConnection(ws: WebSocket) {
        this._sockets.push(ws as WebSocketHack);
        this.initMsgHandler(ws);
        this.initErrorHandler(ws);
        this.write(ws, queryChainLengthMsg());
    }

    private initMsgHandler(ws: WebSocket) {
        ws.on('message', (data: WebSocket.Data) => {
            const msg = JSON.parse(data.toString());
            console.log(`received message: ${JSON.stringify(msg)}`);
            switch (msg.type) {
                case messageType.QUERY_LATEST:
                    this.write(ws, this.responseLatestMsg());
                    break;
                case messageType.QUERY_ALL:
                    this.write(ws, this.responseAllMsg());
                    break;
                case messageType.RESPONSE_BLOCKCHAIN:
                    this.handleBlockchainResponse(msg);
                    break;
            }
        })
    }

    private initErrorHandler(ws: WebSocket) {
        const closeConnection = (ws: WebSocket) => {
            console.log(`connection failed to find peer: ${ws.url}`);
            this._sockets.splice(this._sockets.indexOf(ws as WebSocketHack), 1);
        }
        ws.on('close', () => closeConnection(ws));
        ws.on('error', () => closeConnection(ws));
    }

    private broadcast(message: any) {
        this._sockets.forEach((s) => this.write(s, message));
    }

    private write(ws: WebSocket, message: any) {
        ws.send(JSON.stringify(message));
    }

    private responseLatestMsg(): ResponseMessage {
        return {
            'type': messageType.RESPONSE_BLOCKCHAIN,
            'data': JSON.stringify([blockchain.getLatestBlock()]),
        }
    }

    private responseAllMsg(): ResponseMessage {
        return {
            'type': messageType.RESPONSE_BLOCKCHAIN,
            'data': JSON.stringify(blockchain.getBlocks()),
        }
    }

    private handleBlockchainResponse(message: ResponseMessage) {
        const receivedBlocks = JSON.parse(message.data)
                                   .sort((b1: Block, b2: Block) => {
                                       (b1.getIndex() - b2.getIndex()) 
                                   });
        const latestBlockReceived: Block = receivedBlocks[receivedBlocks.length - 1];
        const latestBlockHeld = blockchain.getLatestBlock();
        if (latestBlockReceived.getIndex() > latestBlockHeld.getIndex()) {
            console.log(`ALERT: blockchain is possibly behind. We got: ${latestBlockHeld.getIndex()} Peer got: ${latestBlockReceived.getIndex()}`);
            if (latestBlockHeld.getHash() === latestBlockReceived.getPrevHash()) {
                console.log('Appending the new block onto this chain...');
                blockchain.addBlock(latestBlockReceived);
                this.broadcast(this.responseLatestMsg());
            } else if (receivedBlocks.length === 1) {
                console.log('Querying the chain from peer...');
                this.broadcast(this.queryAllMsg());
            } else {
                console.log('Found newest longest chain! Replacing chain...');
                replaceChain(receivedBlocks);
            }
        } else {
            console.log('received blockchain that is not longer than ours.');
        }
    }

    private queryAllMsg() {
        return {
            'type': messageType.QUERY_ALL
        }
    }

    private queryChainLengthMsg() {
        return {
            'type': messageType.QUERY_LATEST
        }
    }
}

var replaceChain = (newBlocks) => {
    if (isValidChain(newBlocks) && newBlocks.length > blockchain.length) {
        console.log('Received blockchain is valid. Replacing current blockchain with received blockchain');
        blockchain = newBlocks;
        broadcast(responseLatestMsg());
    } else {
        console.log('Received blockchain invalid');
    }
};

var connectToPeers = (newPeers: string[]) => {
    newPeers.forEach((peer) => {
        var ws = new WebSocket(peer);
        ws.on('open', () => initConnection(ws));
        ws.on('error', () => {
            console.log('connection failed')
        });
    });
};

connectToPeers(initialPeers);
initHttpServer();

initP2PServer();
