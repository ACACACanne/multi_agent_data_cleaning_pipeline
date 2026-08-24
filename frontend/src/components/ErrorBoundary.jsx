// frontend/src/components/ErrorBoundary.jsx
import React from "react";

/**
 * ErrorBoundary
 *
 * - Catches rendering errors and displays a readable UI instead of a white screen.
 * - Shows error message, stack, and a reload button.
 */

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error, info: null };
  }

  componentDidCatch(error, info) {
    // Save stack/info for display
    this.setState({ error, info });
    // Also log to console for dev tools
    // eslint-disable-next-line no-console
    console.error("Uncaught error in React tree:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error, info } = this.state;
    const message = error?.message || String(error) || "Unknown error";

    return (
      <div className="bg-red-900 text-white p-6 rounded-md border border-red-700">
        <h2 className="text-xl font-bold mb-2">Application error</h2>
        <p className="mb-2">
          An error occurred while rendering the application.
        </p>

        <div className="mb-4">
          <strong className="block text-sm text-red-200">Error</strong>
          <div className="bg-red-800 p-3 rounded text-sm wrap-break-word">
            {message}
          </div>
        </div>

        {info?.componentStack && (
          <div className="mb-4">
            <strong className="block text-sm text-red-200">
              Component stack
            </strong>
            <pre className="bg-red-800 p-3 rounded text-xs overflow-auto max-h-48">
              {info.componentStack}
            </pre>
          </div>
        )}

        {error?.stack && (
          <div className="mb-4">
            <strong className="block text-sm text-red-200">Stack trace</strong>
            <pre className="bg-red-800 p-3 rounded text-xs overflow-auto max-h-48">
              {error.stack}
            </pre>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={this.handleReload}
            className="px-4 py-2 rounded bg-white text-red-900 font-semibold"
          >
            Reload page
          </button>

          <button
            onClick={() => {
              const payload = {
                message,
                stack: error?.stack || "",
                componentStack: info?.componentStack || "",
                url: window.location.href,
                userAgent: navigator.userAgent,
              };
              try {
                navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
                // eslint-disable-next-line no-alert
                alert("Error details copied to clipboard.");
              } catch {
                // eslint-disable-next-line no-alert
                alert(
                  "Could not copy to clipboard. Check console for details.",
                );
              }
            }}
            className="px-4 py-2 rounded bg-gray-700 text-white"
          >
            Copy error details
          </button>
        </div>
      </div>
    );
  }
}
