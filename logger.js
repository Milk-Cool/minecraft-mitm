export class Logger {
    static log(...data) {
        for(const piece of data) {
            if(typeof piece == "string")
                console.log("string", piece);
            else if(piece instanceof Buffer)
                console.log("buffer len =", piece.length, ":", piece.toString("hex").match(/.{1,2}/g)?.join(" "));
            else if(typeof piece == "number")
                console.log("number", piece);
            else if(typeof piece == "boolean")
                console.log("bool  ", piece);
        }
    }
}