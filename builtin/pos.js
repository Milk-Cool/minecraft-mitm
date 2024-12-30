export default function posModule(from, packetID, data, Packet, meta) {
    if(from === "client") {
        if(packetID !== 0x1c) return;
        // position
        const x = data.readDoubleBE(0);
        const y = data.readDoubleBE(8);
        const z = data.readDoubleBE(16);
        console.log("pos update from client", meta.username, x, y, z);
    } else if(from === "server") {
        if(packetID !== 0x42) return;
        // position but from server
        let _;
        [_, data] = Packet.readVarInt(data);
        const x = data.readDoubleBE(0);
        const y = data.readDoubleBE(8);
        const z = data.readDoubleBE(16);
        console.log("pos update from server", meta.username, x, y, z);
    }
}