import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppShell } from './layout/AppShell';
import { ProcessingOverlay } from './layout/ProcessingOverlay';
import './three-bvh-setup';

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <AppShell />
        <ProcessingOverlay />
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast:
                'bg-background text-foreground border border-border shadow-lg',
              description: 'text-muted-foreground',
            },
          }}
        />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
