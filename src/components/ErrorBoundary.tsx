import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[SoftJaws] Unhandled error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
            <h1 className="text-2xl font-bold">Something went wrong</h1>
            <pre className="max-w-lg rounded bg-muted p-4 text-sm text-muted-foreground">
              {this.state.error?.message}
            </pre>
            <button
              className="rounded bg-primary px-4 py-2 text-primary-foreground"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try again
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
