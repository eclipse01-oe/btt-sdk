export const toCookieHeader = (cookies: any[]) => cookies.map((c) => `${c.name}=${c.value}`).join("; ");
