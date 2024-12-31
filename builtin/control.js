export default function controlModule(from, packetID, data, Packet, meta, _libs) {
    if(from !== "client") return;
    if(packetID === 0x05) {
        // command
        let newData = data, len;
        [len, newData] = Packet.readVarInt(newData);
        // remaining is string
        const cmd = newData.toString("utf-8").split(/\s+/g);
        if(cmd[0] === "mitm:kill") {
            console.log("Got /mitm:kill, force-exiting!")
            process.exit(0);
        } else if(cmd[0] === "mitm:printstats") {
            return {
                "id": 0x05,
                "data": Packet.constructString(`me :${meta.port}->${meta.destAddr}:${meta.destPort} proto ${meta.protocolVersion} log ${meta.logAll} modules ${meta.modulesStr.join(" ")}`)
            }
        }
    }
}