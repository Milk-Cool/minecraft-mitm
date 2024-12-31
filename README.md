# minecraft-mitm
something like mitmproxy but for minecraft

# Installation
```sh
npm i minecraft-mitm -g
```

# Usage
```
minecraft-mitm [-ha] [-l PORT] [-v VERSION] [-p PROTOCOL_VERSION] [-m MODULE1 [-m MODULE2 ...]] <ADDR>

Examples:
minecraft-mitm -h
minecraft-mitm -a localhost
minecraft-mitm -l 30000 -m builtin/chat.js localhost
minecraft-mitm -v 1.12.2 -p 340 localhost:25595

Description:

-h, --help            Prints this messsage and exits
-a, --log-all         Logs all connections and packets to cap/ directory
-l, --listen          Port to listen at
-v, --version         Minecraft version to use, defaults to 1.21.4
-p, protocol-version  Minecraft protocol version to use. Must be set if not default, defaults to 769
ADDR                  Address to proxy to in format <ip.ip.ip.ip[:port] | doma.in[:port]>
```