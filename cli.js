#!/usr/bin/env node
import { MinecraftMitm } from "./index.js";

const mitm = new MinecraftMitm(25565, "play.mclucky.net", 25565, {
    "version": "1.21.4",
    "protocolVersion": 769
});
mitm.startServer();