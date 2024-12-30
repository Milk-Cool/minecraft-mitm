#!/usr/bin/env node
import { MinecraftMitm } from "./index.js";
import { parseArgs } from "util";

process.on("uncaughtException", e => console.error(e));
process.on("unhandledRejection", e => console.error(e));

const { values, positionals } = parseArgs({ "options": {
    "help": {
        "type": "boolean",
        "short": "h",
    },
    "listen": {
        "type": "string",
        "short": "l",
        "default": "25565"
    },
    "version": {
        "type": "string",
        "short": "v",
        "default": "1.21.4"
    },
    "protocol-version": {
        "type": "string",
        "short": "p",
        "default": "769"
    },
    "log-all": {
        "type": "boolean",
        "short": "a"
    }
}, "allowPositionals": true });
if(values.help) {
    console.log(`minecrat-mitm

Usage:
minecraft-mitm [-ha] [-l PORT] [-v VERSION] [-p PROTOCOL_VERSION] <ADDR>

Examples:
minecraft-mitm -h
minecraft-mitm -a localhost
minecraft-mitm -l 30000 localhost
minecraft-mitm -v 1.12.2 -p 340 localhost:25595

Description:

-h, --help            Prints this messsage and exits
-a, --log-all         Logs all connections and packets to cap/ directory
-l, --listen          Port to listen at
-v, --version         Minecraft version to use, defaults to 1.21.4
-p, protocol-version  Minecraft protocol version to use. Must be set if not default, defaults to 769
ADDR                  Address to proxy to in format <ip.ip.ip.ip[:port] | doma.in[:port]>`)
    process.exit(0);
}
if(positionals.length == 0) {
    console.log("No addresses! Exiting.");
    process.exit(1);
}
const addrRaw = positionals[0].split(":");
const addr = addrRaw[0];
const port = parseInt(addrRaw[1] ?? "25565");

const mitm = new MinecraftMitm(parseInt(values.listen), addr, port, {
    "version": values.version,
    "protocolVersion": parseInt(values["protocol-version"]),
    "logAll": values["log-all"]
});
mitm.startServer();