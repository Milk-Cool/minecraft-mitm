import { inflateSync, deflateSync } from "zlib";
import varint from "varint";

export class Packet {
    static construct(id, data) {
        const idEnc = Buffer.from(varint.encode(id));
        const length = data.length + idEnc.length;
        return Buffer.concat([
            Buffer.from(varint.encode(length)),
            idEnc,
            data
        ]);
    }
    static constructSmart(id, data, compress, maxLength) {
        const idEnc = Buffer.from(varint.encode(id));
        const length = data.length + idEnc.length;
        const len0 = Buffer.from(varint.encode(0));
        // if(compress)
        if(compress) {
            if(length >= maxLength) return Packet.compress(Buffer.concat([idEnc, data]));
            else return Buffer.concat([Buffer.from(varint.encode(length + len0.length)), len0, idEnc, data])
        } else
            return Buffer.concat([
                Buffer.from(varint.encode(length)),
                idEnc,
                data
            ]);
    }
    static constructString(str) {
        const lenEnc = Buffer.from(varint.encode(str.length));
        return Buffer.concat([lenEnc, Buffer.from(str, "utf-8")]);
    }
    static constructVarInt(num) {
        return Buffer.from(varint.encode(num));
    }
    static constructShort(num) {
        const buf = Buffer.alloc(2);
        buf.writeUInt16BE(num);
        return buf;
    }
    static constructInt(num) {
        const buf = Buffer.alloc(4);
        buf.writeUInt32BE(num);
        return buf;
    }
    static compress(data) {
        const compressed = deflateSync(data);
        const lengthInner = Buffer.from(varint.encode(data.length));
        const lengthOuter = Buffer.from(varint.encode(compressed.length + lengthInner.length));
        return Buffer.concat([
            lengthOuter,
            lengthInner,
            compressed
        ]);
    }

    static readVarInt(data) {
        const res = varint.decode(data);
        data = Buffer.from(data.toString("hex").slice(varint.decode.bytes * 2), "hex");
        return [res, data];
    }

    constructor(data, compressed = false) {
        // console.log("raw chicken", data.toString("hex"), compressed);
        if(compressed) {
            let lengthOuter, lengthInner;
            [lengthOuter, data] = Packet.readVarInt(data);
            [lengthInner, data] = Packet.readVarInt(data);
            // console.log(lengthOuter, lengthInner);
            // console.log("toinflate", data.toString("hex"));
            if(lengthInner > 0) data = inflateSync(data);
        } else {
            let length;
            [length, data] = Packet.readVarInt(data);
        }
        let packetID;
        [packetID, data] = Packet.readVarInt(data);
        this.packetID = packetID;
        /** @type {Buffer} */
        this.data = data;
    }

    readVarInt() {
        const res = varint.decode(this.data);
        this.data = Buffer.from(this.data.toString("hex").slice(varint.decode.bytes * 2), "hex");
        return res;
    }
    readVarIntLen() {
        const res = varint.decode(this.data);
        this.data = Buffer.from(this.data.toString("hex").slice(varint.decode.bytes * 2), "hex");
        return [res, varint.decode.bytes];
    }
    readString() {
        const len = this.readVarInt();
        const str = Buffer.from(this.data.toString("hex").slice(0, 2 * len), "hex").toString("utf-8");
        this.data = Buffer.from(this.data.toString("hex").slice(len * 2), "hex");
        return str;
    }
}