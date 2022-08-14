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
              const artifacts = zokratesProvider.compile(payload);
              const end = performance.now();
              ctx.postMessage({
                type: type,
                payload: artifacts,
                span: { start, end },
              });
              break;
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
