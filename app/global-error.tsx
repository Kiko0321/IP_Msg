"use client";

// Replaces the root layout when it fails, so it brings its own <html>/<body> and inline styles
// (global CSS is not loaded here).
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          margin: 0,
          padding: 32,
          textAlign: "center",
        }}
      >
        <title>Something went wrong · IP Messenger</title>
        <h1 style={{ fontSize: 24, margin: 0 }}>Something went wrong</h1>
        <p style={{ margin: 0, opacity: 0.7 }}>Please reload. If it keeps happening, share the error ID below.</p>
        {error.digest && <code>Error ID: {error.digest}</code>}
        <button type="button" onClick={() => retry()} style={{ padding: "8px 16px", cursor: "pointer" }}>
          Try again
        </button>
      </body>
    </html>
  );
}
