import * as bodyParser from 'body-parser';
import * as express from 'express';
import * as WebSocket from 'ws';

import { Block, BlockChain } from './blockchain';
import { genesisBlock } from './genesis';

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


}

var initConnection = (ws: WebSocket) => {
    sockets.push(ws as WebSocketHack);
    initMessageHandler(ws);
    initErrorHandler(ws);
    write(ws, queryChainLengthMsg());
};

var initMessageHandler = (ws: WebSocket) => {
    ws.on('message', (data: any) => {
        var message = JSON.parse(data);
        console.log('Received message' + JSON.stringify(message));
        switch (message.type) {
            case messageType.QUERY_LATEST:
                write(ws, responseLatestMsg());
                break;
            case messageType.QUERY_ALL:
                write(ws, responseChainMsg());
                break;
            case messageType.RESPONSE_BLOCKCHAIN:
                handleBlockchainResponse(message);
                break;
        }
    });
};

var handleBlockchainResponse = (message) => {
    var receivedBlocks = JSON.parse(message.data).sort((b1, b2) => (b1.index - b2.index));
    var latestBlockReceived = receivedBlocks[receivedBlocks.length - 1];
    var latestBlockHeld = blockchain.getLatestBlock();
    if (latestBlockReceived.index > latestBlockHeld.getIndex()) {
        console.log('blockchain possibly behind. We got: ' + latestBlockHeld.getIndex() + ' Peer got: ' + latestBlockReceived.index);
        if (latestBlockHeld.getHash() === latestBlockReceived.previousHash) {
            console.log("We can append the received block to our chain");
            blockchain.push(latestBlockReceived);
            broadcast(responseLatestMsg());
        } else if (receivedBlocks.length === 1) {
            console.log("We have to query the chain from our peer");
            broadcast(queryAllMsg());
        } else {
            console.log("Received blockchain is longer than current blockchain");
            replaceChain(receivedBlocks);
        }
    } else {
        console.log('received blockchain is not longer than received blockchain. Do nothing');
    }
};

var initErrorHandler = (ws: WebSocket) => {
    var closeConnection = (ws: WebSocket) => {
        console.log('connection failed to peer: ' + ws.url);
        sockets.splice(sockets.indexOf(ws as WebSocketHack), 1);
    };
    ws.on('close', () => closeConnection(ws));
    ws.on('error', () => closeConnection(ws));
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

var queryChainLengthMsg = () => ({'type': messageType.QUERY_LATEST});
var queryAllMsg = () => ({'type': messageType.QUERY_ALL});
var responseChainMsg = () =>({
    'type': messageType.RESPONSE_BLOCKCHAIN, 'data': JSON.stringify(blockchain)
});
var responseLatestMsg = () => ({
    'type': messageType.RESPONSE_BLOCKCHAIN,
    'data': JSON.stringify([blockchain.getLatestBlock()])
});

var write = (ws: WebSocket, message: any) => ws.send(JSON.stringify(message));
var broadcast = (message: any) => sockets.forEach(socket => write(socket, message));

