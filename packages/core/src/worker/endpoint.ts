import type { WorkerEndpoint } from "./protocol.types.js";

export interface MessageTarget<Incoming, Outgoing> {
  postMessage(message: Outgoing): void;
  addEventListener(type: "message", listener: (event: MessageEvent<Incoming>) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEvent<Incoming>) => void): void;
}

export function messageEndpoint<Incoming, Outgoing>(
  target: MessageTarget<Incoming, Outgoing>,
): WorkerEndpoint<Incoming, Outgoing> {
  return {
    postMessage: (message) => target.postMessage(message),
    subscribe: (listener) => {
      const receive = (event: MessageEvent<Incoming>) => listener(event.data);
      target.addEventListener("message", receive);
      return () => target.removeEventListener("message", receive);
    },
  };
}
