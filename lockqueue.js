export class LockQueue {
    constructor() {
        this.cbs = [];
        this.lock = false;
        setInterval(async () => {
            if(this.lock) return;
            if(this.cbs.length == 0) return;
            this.lock = true;
            await this.cbs[0]();
            this.cbs = this.cbs.slice(1);
            this.lock = false;
        });
    }

    push(cb) {
        this.cbs.push(cb);
    }
};