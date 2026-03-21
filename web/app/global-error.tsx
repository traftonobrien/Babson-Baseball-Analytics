"use client";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-100 antialiased">
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8">
          <div className="text-center max-w-md">
            <h2 className="text-xl font-semibold text-zinc-100 mb-2">
              Application error
            </h2>
            <p className="text-sm text-zinc-400 mb-6">
              {error.message || "A critical error occurred. Please reload the page."}
            </p>
            {error.digest && (
              <p className="text-xs text-zinc-600 mb-4">
                Error ID: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              className="px-4 py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-md border border-zinc-700 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
