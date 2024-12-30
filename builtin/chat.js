export default function chatPlugin(from, packetID, data, Packet, meta) {
    if(from !== "client") return;
    if(packetID === 0x05) {
        // command
        let newData = data, len;
        [len, newData] = Packet.readVarInt(newData);
        // remaining is string
        const cmd = newData.toString("utf-8");
        console.log("chat command", meta.username, cmd);
    } else if(packetID === 0x07) {
        // message
        let newData = data, len;
        [len, newData] = Packet.readVarInt(newData);
        // remaining len bytes is string
        const msg = newData.subarray(0, len).toString("utf-8");
        console.log("chat message", meta.username, msg);
    }
}