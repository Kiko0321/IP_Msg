import { vi } from "vitest";

// Shared stand-ins for the Next.js and Supabase server APIs that Server Actions and Route Handlers
// use, so their logic can be regression-tested without a running app or a real Supabase project.
// Use with vi.mock(...) in a test file; see app/(auth)/actions.test.ts.

// next/navigation's redirect() throws to stop the action; tests catch it and read the URL.
export class RedirectError extends Error {
  constructor(public url: string) {
    super(`NEXT_REDIRECT ${url}`);
  }
}

export const navigationMock = {
  redirect: vi.fn((url: string) => {
    throw new RedirectError(url);
  }),
};

/** Runs an action and returns where it redirected to, or its return value. */
export async function run<T>(action: () => Promise<T>): Promise<{ redirect?: string; result?: T }> {
  try {
    return { result: await action() };
  } catch (error) {
    if (error instanceof RedirectError) return { redirect: error.url };
    throw error;
  }
}

export function formData(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

type Result = { data?: unknown; error?: { message: string } | null };

/**
 * A chainable fake of the Supabase client. Every query-builder call returns the same builder, and
 * awaiting it (or calling single/maybeSingle) resolves to `queryResult`. Auth and storage calls
 * are plain vi.fn()s that tests can override.
 */
export function fakeSupabase({
  userId = "11111111-1111-4111-8111-111111111111",
  signedIn = true,
  queryResult = { data: null, error: null } as Result,
} = {}) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "insert", "update", "upsert", "delete", "eq", "in", "order", "limit"]) {
    query[method] = vi.fn(() => query);
  }
  query.single = vi.fn(async () => queryResult);
  query.maybeSingle = vi.fn(async () => queryResult);
  query.then = (resolve: (value: Result) => unknown) => Promise.resolve(queryResult).then(resolve);

  const bucket = {
    list: vi.fn(async () => ({ data: [] as { name: string }[], error: null })),
    remove: vi.fn(async () => ({ data: [] as unknown[], error: null })),
    getPublicUrl: vi.fn((path: string) => ({ data: { publicUrl: `https://cdn.example/${path}` } })),
  };

  return {
    query,
    bucket,
    from: vi.fn(() => query),
    rpc: vi.fn(async () => ({ data: null, error: null }) as Result),
    storage: { from: vi.fn(() => bucket) },
    auth: {
      getClaims: vi.fn(async () => ({ data: signedIn ? { claims: { sub: userId } } : null, error: null })),
      signInWithPassword: vi.fn(async () => ({ data: {}, error: null }) as Result),
      signUp: vi.fn(async () => ({ data: { session: {} }, error: null }) as Result),
      resetPasswordForEmail: vi.fn(async () => ({ data: {}, error: null }) as Result),
      updateUser: vi.fn(async () => ({ data: {}, error: null }) as Result),
      exchangeCodeForSession: vi.fn(async () => ({ data: {}, error: null }) as Result),
      verifyOtp: vi.fn(async () => ({ data: {}, error: null }) as Result),
      signOut: vi.fn(async () => ({ error: null })),
    },
  };
}

export type FakeSupabase = ReturnType<typeof fakeSupabase>;
