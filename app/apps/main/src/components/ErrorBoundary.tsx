import * as React from 'react';

interface State {
  error: Error | null;
}

/** Catches render errors so an unexpected failure shows a recoverable message, not a blank page. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[laplace] render error', error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div style={{ maxWidth: 640, margin: '120px auto', padding: '0 24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, letterSpacing: '-0.02em' }}>Something went wrong.</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 12, lineHeight: 1.6 }}>
          An unexpected error occurred. Reloading usually fixes it.
        </p>
        <pre
          style={{
            marginTop: 16, padding: 12, fontSize: 12, color: 'var(--text-secondary)',
            background: 'var(--bg-alter)', border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-sm)', whiteSpace: 'pre-wrap', textAlign: 'left', overflowX: 'auto',
          }}
        >
          {error.message}
        </pre>
        <button className="btn btn--accent" style={{ marginTop: 20 }} onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
