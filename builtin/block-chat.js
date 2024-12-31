// TODO: maybe support a blocklist?
export default function blockChatModule(from, packetID, _data, _Packet, _meta, _libs) {
    if(from !== "client") return;
    if(packetID === 0x05 || packetID === 0x07) return false;
}