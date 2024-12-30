import varint from "varint";
import net, { Socket } from "net";
import { stages, SocketData } from "./socketdata.js";
import { favicon } from "./favicon.js";
import { Logger } from "./logger.js";
import { LockQueue } from "./lockqueue.js";
import { inflateSync } from "zlib";
import { Client } from "./client.js";
import { Packet } from "./packet.js";
import { sleep } from "./sleep.js";
import { generateKeyPairSync, randomBytes } from "crypto";
import fs from "fs";
import path, { join } from "path";
import { compressed } from "./compressed.js";

/** @typedef {{ version: string, protocolVersion: number, encrypt: boolean, compressAfter: number, logAll: string }} MinecraftMitmOptions */
export class MinecraftMitm {
    /**
     * @param {MinecraftMitmOptions} opts 
     * @param {string[]} modules
     */
    constructor(port, destAddr, destPort, opts, modules = []) {
        this.q = new LockQueue();
        this.out = new LockQueue();

        this.port = port;
        this.destAddr = destAddr;
        this.destPort = destPort;

        this.version = opts.version;
        this.protocolVersion = opts.protocolVersion;
        this.encrypt = opts.encrypt ?? false;
        this.compressAfter = opts.compressAfter ?? -1;
        this.logAll = opts.logAll ?? false;

        this.modulesRaw = modules;

        // const keys = generateKeyPairSync("rsa", { "modulusLength": 1024 });
        // this.privateKey = keys.privateKey;
        // this.publicKey = keys.publicKey;

        this.server = net.createServer(socket => this.handleSocket(socket));
        /** @type {[Socket, SocketData, Client][]} */
        this.sockets = [];

        if(!fs.existsSync("cap"))
            fs.mkdirSync("cap")

        process.on("SIGINT", () => {
            for(const socketID in this.sockets) {
                if(this.sockets[socketID] == null) continue;
                Logger.log("forceexit", socketID);
                this.sockets[socketID][2].client.destroy();
                if(this.logAll) fs.writeFileSync("cap/" + socketID + "/log.txt", this.sockets[socketID][3]);
            }
            process.exit(0);
        });
    }

    async initModules() {

        this.modules = [];
        for(const module of this.modulesRaw) {
            let moduleFunc;
            if(fs.existsSync(module))
                ({ default: moduleFunc } = await import(path.resolve(module)));
            else
                ({ default: moduleFunc } = await import(join(import.meta.dirname, module)));
            this.modules.push(moduleFunc);
            Logger.log("Loaded module!", module);
        }
    }

    /**
     * @param {Socket} socket 
     */
    handleSocket(socket) {
        const socketID = this.sockets.length;
        Logger.log("new socket", socketID);
        if(!fs.existsSync("cap/" + socketID))
            fs.mkdirSync("cap/" + socketID);
        this.sockets.push([socket, new SocketData(), new Client(
            this.destAddr, this.destPort,
            this.protocolVersion),
            ""
        ]);

        this.sockets[socketID][2].handlerSet = true;
        this.sockets[socketID][2].cbs.push(d => {
            if(this.sockets[socketID][1].stage != stages.PLAY) return;
            const pack = new Packet(d, 
                this.sockets[socketID][2].compress && compressed(d, this.sockets[socketID][2].compressSize)/*this.sockets[socketID][1].compress && this.getlen(d) > this.sockets[socketID][1].compressSize*/
            );
            const id = pack.packetID;
            for(const module of this.modules) {
                if(module("server", id, pack.data, Packet, {
                    "socketID": socketID,
                    "username": this.sockets[socketID][1].username
                }) === false)
                    return;
            }
            if(this.logAll) this.sockets[socketID][3] += `S ${this.sockets[socketID][1].stage} ${id}\n`;
            if(this.logAll) this.sockets[socketID][3] += `->C ${id}\n`;
            this.out.push(() => this.sockets[socketID] && this.writeAsync(this.sockets[socketID][0], d));
        });
        Logger.log("handler set!");

        socket.on("data", data => this.handle(data, socketID));
        socket.on("close", () => {
            Logger.log("exited", socketID);
            this.sockets[socketID][2].client.destroy();
            if(this.logAll) fs.writeFileSync("cap/" + socketID + "/log.txt", this.sockets[socketID][3]);
            this.sockets[socketID] = null;
        });
    }

    /**
     * @param {Buffer} data 
     */
    handleHandshake(data, socketID) {
        if(this.logAll) this.sockets[socketID][3] += "handshake\n";

        // TODO: replace with Packet.* functions
        const protocolVersion = varint.decode(data);
        data = Buffer.from(data.toString("hex").slice(varint.decode.bytes * 2), "hex");
        this.sockets[socketID][1].protocolVersion = protocolVersion;

        const addrLength = varint.decode(data);
        const addr = data.toString("utf-8", varint.decode.bytes, varint.decode.bytes + addrLength);
        data = Buffer.from(data.toString("hex").slice(varint.decode.bytes * 2 + addrLength * 2), "hex");
        this.sockets[socketID][1].addr = addr;

        const port = data.readUInt16BE();
        data = Buffer.from(data.toString("hex").slice(2 * 2), "hex");
        this.sockets[socketID][1].port = port;

        const nextState = varint.decode(data);
        data = Buffer.from(data.toString("hex").slice(varint.decode.bytes * 2), "hex");
        this.sockets[socketID][1].handshakeNextState = nextState;

        Logger.log("protocol version", protocolVersion, "address", addr, "port", port, "next", nextState);

        this.sockets[socketID][1].stage = nextState == 1 ? stages.STATUS : stages.LOGIN;
    }

    /**
     * @param {number} socketID 
     */
    async handleStatus(socketID) {
        // const res = Buffer.from(JSON.stringify({
        //     "version": {
        //         "name": this.version,
        //         "protocol": this.protocolVersion
        //     },
        //     "players": {
        //         "max": 9999,
        //         "online": 6942,
        //         "sample": []
        //     },
        //     "description": {
        //         "text": "MITM"
        //     },
        //     "favicon": favicon
        // }), "utf-8");
        if(this.logAll) this.sockets[socketID][3] += "status\n";
        await this.sockets[socketID][2].waitTillReady();
        this.sockets[socketID][2].handshake(stages.STATUS);
        await sleep(100);
        const banner = await this.sockets[socketID][2].getBanner();
        // Logger.log(JSON.stringify(banner));
        const res = Buffer.from(JSON.stringify(banner), "utf-8");
        const resEnc = Packet.construct(0, Buffer.concat([
            Buffer.from(varint.encode(res.length)),
            res
        ]));
        if(this.logAll) this.sockets[socketID][3] += `->C ${0}\n`;
        this.out.push(() => this.sockets[socketID] && this.writeAsync(this.sockets[socketID][0], resEnc));
    }

    writeAsync(s, d) {
        return new Promise((resolve, _reject) => {
            s.write(d, () => resolve());
        });
    }

    /**
     * @param {Buffer} data 
     * @param {number} socketID 
     */
    handlePing(data, socketID) {
        if(this.logAll) this.sockets[socketID][3] += `->C ${1}\n`;
        this.out.push(() => this.writeAsync(this.sockets[socketID][0], Packet.construct(
            1,
            data
        )));
    }

    getPubKey() {
        // const nodeKey = this.publicKey.export({ "format": "der", "type": "pkcs1" });
        // const rawKeyHex = nodeKey.toString("hex").slice(16 * 2);
        // return Buffer.from(rawKeyHex, "hex");
        return this.publicKey.export({ "format": "der", "type": "spki" });
        // return Buffer.from(this.publicKey.export({ "format": "pem", "type": "pkcs1" })
        //     .replaceAll("-----BEGIN RSA PUBLIC KEY-----\n", "").replaceAll("\n-----END RSA PUBLIC KEY-----\n", "").replaceAll("\n", ""), "base64");
    }

    /**
     * @param {Buffer} data 
     * @param {number} socketID 
     */
    async handleLoginStart(data, socketID) {
        if(this.logAll) this.sockets[socketID][3] += "login start\n";
        // TODO: read string to helper function
        const usernameLength = varint.decode(data);
        const username = data.toString("utf-8", varint.decode.bytes, varint.decode.bytes + usernameLength);
        Logger.log("player joining is", username);
        data = Buffer.from(data.toString("hex").slice(varint.decode.bytes * 2 + usernameLength * 2), "hex");
        this.sockets[socketID][1].username = username;
        this.sockets[socketID][1].uuid = data;

        if(this.encrypt) {
            // NOTE: this DOES NOT work and will probably NOT be worked on.
            const pubKeyDer = this.getPubKey();
            const verifyTokenLen = 4;
            if(this.logAll) this.sockets[socketID][3] += `->C ${1}\n`;
            this.out.push(() => this.sockets[socketID] && this.writeAsync(this.sockets[socketID][0], Packet.construct(1, Buffer.concat([
                Packet.constructString(""),
                Packet.constructVarInt(pubKeyDer.length),
                pubKeyDer,
                Packet.constructVarInt(verifyTokenLen),
                randomBytes(verifyTokenLen)
            ]))));
        } else {
            this.sockets[socketID][2].compressCb = size => {
                if(this.logAll) this.sockets[socketID][3] += `->C compress ${3}\n`;
                this.out.push(async () => {
                    if(!this.sockets[socketID]) return;
                    await this.writeAsync(this.sockets[socketID][0], Packet.construct(3, Packet.constructVarInt(size)));
                    this.sockets[socketID][1].compress = true;
                    this.sockets[socketID][1].compressSize = size;
                });
            }

            let done = false;
            this.sockets[socketID][2].cbs.push(d => {
                if(done) return;
                const pack = new Packet(d, this.sockets[socketID][2].compress && compressed(d, this.sockets[socketID][2].compressSize)/*this.sockets[socketID][1].compress && this.getlen(d) > this.sockets[socketID][1].compressSize*/);
                if(this.logAll) this.sockets[socketID][3] += `S WAIT4LOGIN ${pack.packetID}\n`;
                if(pack.packetID != 2) return;
                Logger.log("got login done packet from destination!");
                let data = Packet.constructSmart(2, pack.data, this.sockets[socketID][2].compress, this.sockets[socketID][2].compressSize);
                // Logger.log("deflated resp", data);
                if(this.logAll) this.sockets[socketID][3] += `->C WAIT4LOGIN ${2}\n`;
                this.out.push(() => this.sockets[socketID] && this.writeAsync(this.sockets[socketID][0], data));
                this.sockets[socketID][1].stage = stages.PLAY;
                this.sockets[socketID][2].loggedIn = true;
                done = true;
            });

            await this.sockets[socketID][2].waitTillReady();
            this.sockets[socketID][2].handshake(stages.LOGIN);
            await sleep(100);
            this.sockets[socketID][2].loginStart(this.sockets[socketID][1].username, this.sockets[socketID][1].uuid);
        }
    }

    /**
     * @param {Buffer} data 
     */
    handleUncompressed(data, packetID, socketID) {
        // Logger.log("stage", this.sockets[socketID][1].stage);
        // Logger.log("HANDLING", socketID, packetID, data);

        if(packetID == 0 && this.sockets[socketID][1].stage == stages.HANDSHAKE)
            return this.handleHandshake(data, socketID);
        else if(packetID == 0 && this.sockets[socketID][1].stage == stages.STATUS)
            return this.handleStatus(socketID);
        else if(packetID == 1 && this.sockets[socketID][1].stage == stages.STATUS)
            return this.handlePing(data, socketID);
        else if(packetID == 0 && this.sockets[socketID][1].stage == stages.LOGIN)
            return this.handleLoginStart(data, socketID);
        else
            return this.handleOtherPacket(data, packetID, socketID);
    }

    /**
     * @param {Buffer} data 
     */
    async handleOtherPacket(data, packetID, socketID) {
        if(packetID == 0x3b) {
            // chat message, encrypted? anyway, this is not important
            let newData = data.subarray(16);
            [_index, newData] = Packet.readVarInt(newData);
        }

        for(const module of this.modules) {
            if(module("client", packetID, data, Packet, {
                "socketID": socketID,
                "username": this.sockets[socketID][1].username
            }) === false)
                return;
        }

        // Logger.log("other packet", packetID);
        await this.sockets[socketID][2].waitTillReady();
        if(this.logAll) this.sockets[socketID][3] += `C ${this.sockets[socketID][1].stage} ${packetID}\n`;
        // Logger.log("from client", packetID);
        let rawPack = Packet.constructSmart(packetID, data, this.sockets[socketID][1].compress, this.sockets[socketID][1].compressSize);
        // let rawPack = Packet.construct(packetID, data);
        // if(this.sockets[socketID][1].compress)
        //     rawPack = Packet.compress(rawPack);
        // Logger.log("2bsent", rawPack);
        if(this.logAll) this.sockets[socketID][3] += `->S ${packetID}\n`;
        this.out.push(() => this.sockets[socketID] && this.writeAsync(this.sockets[socketID][2].client, rawPack));
    }

    // /**
    //  * @param {Buffer} data 
    //  */
    // decompress(data) {
    //     const lengthOuter = varint.decode(data);
    //     data = Buffer.from(data.toString("hex").slice(varint.decode.bytes * 2), "hex");
    //     const lengthInner = varint.decode(data);
    //     data = Buffer.from(data.toString("hex").slice(varint.decode.bytes * 2), "hex");
    //     return inflateSync(data);
    // }

    getlen(d) {
        return Packet.readVarInt(Packet.readVarInt(d)[1])[0];
    }

    async handle(buff, socketID) {
        this.sockets[socketID][1].partial = Buffer.concat([this.sockets[socketID][1].partial, buff]);
        while(this.sockets[socketID][1].partial.length > 0) {
            let vi, D, orig = this.sockets[socketID][1].partial;
            try { [vi, D] = Packet.readVarInt(this.sockets[socketID][1].partial); } catch(_) { break; }
            const viL = orig.length - D.length;
            buff = this.sockets[socketID][1].partial;
            if(vi > D.length) break;
            // if(this.sockets[socketID][1].partial === undefined) this.sockets[socketID][1].partial = Buffer.alloc();
            buff = this.sockets[socketID][1].partial.subarray(0, vi + viL);
            this.sockets[socketID][1].partial = this.sockets[socketID][1].partial.subarray(vi + viL);
            // Logger.log("a", buff, /*this.sockets[socketID][1].partial*/);
            const pack = new Packet(buff, this.sockets[socketID][1].compress && compressed(buff, this.sockets[socketID][1].compressSize));
            buff = pack.data;
            // Logger.log("packet id", pack.packetID, "packet data", pack.data);
            // this.q.push(async () => await this.handleUncompressed(buff, pack.packetID, socketID));
            await this.handleUncompressed(buff, pack.packetID, socketID);
        }
    }

    startServer() {
        this.server.listen(this.port);
    }
}