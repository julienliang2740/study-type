type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
  };
};

export async function parseJsonResponse<T>(
  response: Response,
  serviceName: string
): Promise<T> {
  if (response.ok) {
    return (await response.json()) as T;
  }

  const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
  const message =
    body.error?.message ?? `${serviceName} failed with status ${response.status}`;
  throw new Error(message);
}

export async function postJson<T>(
  baseUrl: string,
  path: string,
  body: object,
  serviceName: string,
  unreachableMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });
  } catch {
    throw new Error(unreachableMessage);
  }

  return parseJsonResponse<T>(response, serviceName);
}

export async function getJson<T>(
  baseUrl: string,
  path: string,
  serviceName: string,
  unreachableMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${baseUrl}${path}`);
  } catch {
    throw new Error(unreachableMessage);
  }

  return parseJsonResponse<T>(response, serviceName);
}
