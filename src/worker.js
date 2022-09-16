import { initialize } from "zokrates-js";

const ctx = self; // as unknown as Worker;

async function init() {
  initialize()
    .then((zokratesProvider) => {
      const onAction = (action) => {
        const { type, payload } = action;
        const start = performance.now();
        try {
          switch (type) {
            case "compile": {
              const artifacts = zokratesProvider.compile(payload, {
                config: { debug: true },
              });
              const end = performance.now();
              ctx.postMessage({
                type: type,
                payload: artifacts,
                span: { start, end },
              });
              break;
            }
            case "compute": {
              let logs = [];
              const { output } = zokratesProvider.computeWitness(
                payload.artifacts,
                payload.args,
                { logCallback: (l) => logs.push(l) }
              );
              const end = performance.now();
              ctx.postMessage({
                type: type,
                payload: { output, logs },
                span: { start, end },
              });
            }
            default:
              break;
          }
        } catch (error) {
          const end = performance.now();
          ctx.postMessage({
            type: "error",
            payload: { error, type },
            span: { start, end },
          });
        }
      };
      ctx.addEventListener("message", (ev) => onAction(ev.data));
    })
    .catch((e) => console.error(e));
}

init();
