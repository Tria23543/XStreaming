// The sign-in flow's failures are otherwise invisible in the UI (the
// Home screen just returns to the login prompt). The last failure is
// kept here in plain words — step outcome, HTTP status and which
// Xbox/Microsoft endpoint answered — so the Cloud tab can show it
// under its "not activated" message and a failure can be reported
// exactly instead of guessed at. No tokens or request bodies are ever
// included: only the error's message, the status code, and the
// endpoint's host + path, which are public.

let lastAuthError: string | null = null;

export function describeAuthError(error: any): string {
  if (!error) {
    return 'Unknown error';
  }
  let text = (error && error.message) || String(error);
  const status = error?.response?.status;
  const url = error?.config?.url;
  if (status || url) {
    let where = '';
    if (url) {
      try {
        const u = new URL(url);
        where = `${u.host}${u.pathname}`;
      } catch {}
    }
    const parts = [
      status ? `HTTP ${status}` : '',
      where,
    ].filter(Boolean);
    if (parts.length > 0) {
      text += ` (${parts.join(' · ')})`;
    }
  }
  return text;
}

export function setLastAuthError(error: any) {
  lastAuthError = describeAuthError(error);
}

export function setLastAuthErrorText(text: string) {
  lastAuthError = text;
}

export function getLastAuthError(): string | null {
  return lastAuthError;
}

export function clearLastAuthError() {
  lastAuthError = null;
}
