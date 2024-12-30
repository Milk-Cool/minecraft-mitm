import net from "net";
import { Packet } from "./packet.js";
import { stages } from "./socketdata.js";
import { Logger } from "./logger.js";
import { compressed } from "./compressed.js";

const VERBOSE_DEBUG = false;

export class Client {
    constructor(remoteAddr, remotePort, protocolVersion) {
        this.client = new net.Socket();
        this.ready = false;

        this.remoteAddr = remoteAddr;
        this.remotePort = remotePort;

        this.compress = false;
        this.compressSize = -1;
        this.encrypt = false;
        this.loggedIn = false;
        this.protocolVersion = protocolVersion;
        
        this.handlerSet = false;
        this.cbs = [];
        this.cbsRaw = [];
        this.compressCb = () => null;
        this.bannerCb = () => null;

        if(VERBOSE_DEBUG) this.client.on("data", d => Logger.log("client data", d));
        let partial = Buffer.from("");
        this.client.on("data", d => {
            partial = Buffer.concat([partial, d]);
            while(partial.length > 0) {
                let vi, D, orig = partial;
                try {
                    [vi, D] = Packet.readVarInt(partial);
                } catch(_) { break; }
                const viL = orig.length - D.length;
                if(vi > D.length) break;
                d = partial.subarray(0, vi + viL);
                partial = partial.subarray(vi + viL);
                this.cbsRaw.forEach(x => x(d));
                try {
                    const pt = new Packet(d, this.compress && compressed(d, this.compressSize));
                    if(/*this.compress && this.getlen(d) > this.compressSize*/false) {
                        const pack = new Packet(d, true);
                        d = Packet.constructSmart(pack.packetID, pack.data, this.compress, this.compressSize);
                    } else if(pt.packetID == 3 && !this.loggedIn) {
                        this.compress = true;
                        this.compressSize = Packet.readVarInt(pt.data)[0];
                        this.compressCb(Packet.readVarInt(pt.data)[0]);
                    } else if(pt.packetID == 0 && !this.loggedIn) {
                        try {
                            const str = pt.readString();
                            this.bannerCb(str);
                        } catch(_) {}
                    }
                    else this.cbs.forEach(x => x(d)); // xD
                } catch(_) { this.cbs.forEach(x => x(d)); }
            }
        });

        this.client.connect(remotePort, remoteAddr, () => {
            this.ready = true;
        });
    }

    waitTillReady() {
        return new Promise(resolve => {
            const f = () => this.ready ? resolve() : setTimeout(f);
            f();
        })
    }

    handshake(nextStage) {
        const packRaw = Buffer.concat([
            Packet.constructVarInt(this.protocolVersion),
            Packet.constructString(this.remoteAddr),
            Packet.constructShort(this.remotePort),
            Packet.constructVarInt(nextStage == stages.STATUS ? 1 : 2)
        ]);
        // Logger.log("packraw", packRaw);
        this.client.write(Packet.construct(0, packRaw));
    }

    getlen(d) {
        return Packet.readVarInt(Packet.readVarInt(d)[1])[0];
    }

    getBanner() {
        return new Promise(resolve => {
            this.bannerCb = d => {
                try {
                    const j = JSON.parse(d);
                    resolve(j);
                } catch(_) {}
            }
            // let data = Buffer.from("");
            // TODO: replace with this.bannerCb
            // this.client.on("data", dat => {
            //     // Logger.log("resp from serv", dat);
            //     data = Buffer.concat([data, dat]);
            //     while(data.length > 0) {
            //         let vi, D;
            //         try { [vi, D] = Packet.readVarInt(data); } catch(_) { break; }
            //         // const pack = new Packet(data, this.compress && compressed(data, this.compressSize));
            //         // const v = pack.readVarInt();
            //         dat = data.subarray(0, vi + Packet.constructVarInt(vi).length);
            //         data = data.subarray(vi + Packet.constructVarInt(vi).length);
                    
            //         const pack = new Packet(dat, this.compress && compressed(dat, this.compressSize));
            //         resolve(JSON.parse(pack.readString()));
            //     }
            // });
            this.client.write(Packet.construct(0, Buffer.from("")));
        });
    }

    setLoggedIn(value) {
        this.loggedIn = value;
    }

    loginStart(username, uuid) {
        this.client.write(Packet.construct(0, Buffer.concat([Packet.constructString(username), uuid])));
    }
}