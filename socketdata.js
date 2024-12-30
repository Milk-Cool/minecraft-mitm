export const stages = {
    HANDSHAKE: 0,
    STATUS: 1,
    LOGIN: 2,
    PLAY: 3,
};

export class SocketData {
    constructor() {
        this.stage = stages.HANDSHAKE;

        this.compress = false;
        this.compressSize = -1;
        this.encrypt = false;
        
        this.protocolVersion = -1;
        this.addr = "";
        this.port = -1;
        this.handshakeNextState = -1;

        this.partial = Buffer.from("");

        this.username = "";
        this.uuid = Buffer.from("12".repeat(16), "hex");
    }
}