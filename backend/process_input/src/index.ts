import { createServer } from "node:http";
import { handleRequest } from "./routes.js";

const port = Number.parseInt(process.env.PORT ?? "8788", 10);
const host = process.env.HOST ?? "127.0.0.1";

const server = createServer((request, response) => {
  void handleRequest(request, response);
});

server.listen(port, host, () => {
  console.log(`process_input listening on http://${host}:${port}`);
});
