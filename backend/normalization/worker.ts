import {
  handleNormalizeRequest,
  type NormalizationWorkerEnv
} from "./routes/normalizeRoute";

export { handleNormalizeRequest };

export default {
  fetch(request: Request, env: NormalizationWorkerEnv): Promise<Response> {
    return handleNormalizeRequest(request, env);
  }
};
