import { Packet } from "./packet.js";

// export function compressed(d, thresh = 0) {
//     let lengthInner, lengthOuter;
//     [lengthOuter, d] = Packet.readVarInt(d);
//     [lengthInner, d] = Packet.readVarInt(d);
//     // return lengthInner == 0 ? false : true;
//     return lengthInner == 0 ? false : lengthInner >= thresh;
// }
export function compressed(_d, _thresh) {
    return true; // always used with "this.compress && ..."
}