// Executes python when given input in format \5+2

import { spawnSync } from "child_process";

export default function pythonModule(from, packetID, data, Packet, _meta, _libs) {
    if(from !== "client") return;
    if(packetID === 0x07) {
        // message
        let newData = data, len;
        [len, newData] = Packet.readVarInt(newData);
        // remaining len bytes is string
        const msg = newData.subarray(0, len).toString("utf-8");
        if(msg[0] !== "\\") return;
        const raw = msg[1] === "\\";
        const pyStr = msg.slice(raw ? 2 : 1);
        const cmd = spawnSync("python3", ["-c", `print(${pyStr})`]);
        return { id: 0x07, data: Buffer.concat([Packet.constructString(
            (raw ? ""
            : "> " + pyStr + " < ") +
            cmd.stdout.toString("utf-8").replace(/\r?\n/g, "") +
            cmd.stderr.toString("utf-8").replace(/\r?\n/g, "")
        ), newData.subarray(len)]) }
    }
}