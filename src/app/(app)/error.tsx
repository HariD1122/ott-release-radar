"use client";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto mt-16 max-w-md rounded-2xl border border-line bg-surface p-6 text-center">
      <h1 className="mb-2 text-lg font-bold">Something went wrong</h1>
      <p className="mb-4 text-sm text-muted">
        The service or database may be unavailable. Nothing was claimed as saved.
        {process.env.NODE_ENV !== "production" ? ` (${error.message})` : ""}
      </p>
      <button className="btn btn-primary" onClick={reset}>Try again</button>
    </div>
  );
}
