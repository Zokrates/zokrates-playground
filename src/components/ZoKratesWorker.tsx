import { Observable, Subject } from "rxjs";

export class ZoKratesWorker {
  private worker: Worker;
  private messageSubject = new Subject<MessageEvent>();

  constructor() {
    this.worker = new Worker(new URL("../worker.js", import.meta.url));
    this.worker.onmessage = (data) => this.messageSubject.next(data);
  }

  postMessage(type: string, payload: any) {
    this.worker.postMessage({ type, payload });
  }

  onMessage(): Observable<MessageEvent> {
    return this.messageSubject.asObservable();
  }

  terminate(): void {
    this.worker.terminate();
  }
}