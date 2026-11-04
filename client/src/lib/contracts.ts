export async function contractRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string;
    access?: string;
  } = {},
): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      ...(options.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.access ? { "X-Signing-Access": options.access } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message ?? "Unable to process this contract.");
  }
  return response.json();
}

export async function downloadContract(
  path: string,
  filename: string,
  token?: string,
  access?: string,
) {
  const response = await fetch(path, {
    cache: "no-store",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(access ? { "X-Signing-Access": access } : {}),
    },
  });
  if (!response.ok)
    throw new Error(
      "Unable to download this record. Confirm your email again if your session expired.",
    );
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
