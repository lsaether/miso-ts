"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bodyParser = require("body-parser");
const express = require("express");
const WebSocket = require("ws");
const blockchain_1 = require("./blockchain");
const genesis_1 = require("./genesis");
const httpPort = process.env.HTTP_PORT || 6973;
const p2pPort = process.env.P2P_PORT || 6974;
const initialPeers = process.env.PEERS ? process.env.PEERS.split('.') : [];
const messageType = {
    QUERY_LATEST: 0,
    QUERY_ALL: 1,
    RESPONSE_BLOCKCHAIN: 2,
};
let blockchain = new blockchain_1.BlockChain(genesis_1.genesisBlock());
class Server {
    constructor(httpPort, p2pPort, initialPeers) {
        this._peers = [];
        this._sockets = [];
        this._httpPort = httpPort;
        this._p2pPort = p2pPort;
        this._peers = initialPeers;
    }
    init() {
        this.connectToPeers(this._peers);
        this.initHttp();
        this.initP2P();
    }
    connectToPeers(peers) {
        peers.forEach((peer) => {
            const ws = new WebSocket(peer);
            ws.on('open', () => this.makeConnection(ws));
            ws.on('error', () => {
                console.log('connection failed =(');
            });
        });
    }
    initHttp() {
        const app = express();
        app.use(bodyParser.json());
        app.get('/blocks', (req, res) => {
            res.send(JSON.stringify(blockchain.getBlocks()));
        });
        app.post('/mineBlock', (req, res) => {
            const nextBlock = blockchain.generateNextBlock(req.body.data);
            blockchain.addBlock(nextBlock);
            this.broadcast(this.responseLatestMsg());
            console.log(`block added ${JSON.stringify(nextBlock)}`);
            res.send();
        });
        app.get('/peers', (req, res) => {
            res.send(this._sockets.map(s => s._socket.remoteAddress + ':' + s._socket.remotePort));
        });
        app.post('/addPeer', (req, res) => {
            this.connectToPeers([req.body.peer]);
            res.send();
        });
        app.listen(httpPort, () => console.log(`Listening on port: ${httpPort}`));
    }
    initP2P() {
        const server = new WebSocket.Server({ port: this._p2pPort });
        server.on('connection', (ws) => this.makeConnection(ws));
        console.log(`listening websocket p2p port on: ${this._p2pPort}`);
    }
    makeConnection(ws) {
        this._sockets.push(ws);
        this.initMsgHandler(ws);
        this.initErrorHandler(ws);
        this.write(ws, this.queryChainLengthMsg());
    }
    initMsgHandler(ws) {
        ws.on('message', (data) => {
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
        });
    }
    initErrorHandler(ws) {
        const closeConnection = (ws) => {
            console.log(`connection failed to find peer: ${ws.url}`);
            this._sockets.splice(this._sockets.indexOf(ws), 1);
        };
        ws.on('close', () => closeConnection(ws));
        ws.on('error', () => closeConnection(ws));
    }
    broadcast(message) {
        this._sockets.forEach((s) => this.write(s, message));
    }
    write(ws, message) {
        ws.send(JSON.stringify(message));
    }
    responseLatestMsg() {
        return {
            'type': messageType.RESPONSE_BLOCKCHAIN,
            'data': JSON.stringify([blockchain.getLatestBlock()]),
        };
    }
    responseAllMsg() {
        return {
            'type': messageType.RESPONSE_BLOCKCHAIN,
            'data': JSON.stringify(blockchain.getBlocks()),
        };
    }
    handleBlockchainResponse(message) {
        const receivedBlocks = JSON.parse(message.data)
            .sort((b1, b2) => {
            (b1.getIndex() - b2.getIndex());
        });
        const latestBlockReceived = receivedBlocks[receivedBlocks.length - 1];
        const latestBlockHeld = blockchain.getLatestBlock();
        if (latestBlockReceived.getIndex() > latestBlockHeld.getIndex()) {
            console.log(`ALERT: blockchain is possibly behind. We got: ${latestBlockHeld.getIndex()} Peer got: ${latestBlockReceived.getIndex()}`);
            if (latestBlockHeld.getHash() === latestBlockReceived.getPrevHash()) {
                console.log('Appending the new block onto this chain...');
                blockchain.addBlock(latestBlockReceived);
                this.broadcast(this.responseLatestMsg());
            }
            else if (receivedBlocks.length === 1) {
                console.log('Querying the chain from peer...');
                this.broadcast(this.queryAllMsg());
            }
            else {
                console.log('Found newest longest chain! Replacing chain...');
                this.replaceChain(receivedBlocks);
            }
        }
        else {
            console.log('received blockchain that is not longer than ours.');
        }
    }
    queryAllMsg() {
        return {
            'type': messageType.QUERY_ALL
        };
    }
    queryChainLengthMsg() {
        return {
            'type': messageType.QUERY_LATEST
        };
    }
    /// Not sure this is the best place to put this...
    replaceChain(newChain) {
        // if (isValidChain(newChain));
        // if (newChain.length > blockchain.getBlocks().length) {
        //     console.log('Received blockchain is valid. Replacing the current chain with new one.');
        //     blockchain = newChain;
        // }
        throw new Error('NOT IMPLEMENTED');
    }
}
exports.Server = Server;
const serve = new Server(httpPort, p2pPort, initialPeers);
serve.init();
