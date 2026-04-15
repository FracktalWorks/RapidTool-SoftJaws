/**
 * App — Root component
 *
 * Initializes the workflow store and renders the AppShell.
 * Wraps the app in ThemeProvider for dark/light mode support.
 */

import { useEffect } from 'react';
import { ThemeProvider } from 'next-themes';
import { useWorkflowStore } from '@rapidtool/cad-ui';
import { SOFTJAWS_WORKFLOW_STEPS } from '@/workflow';
import { AppShell } from '@/layout/AppShell';

export function App() {
  useEffect(() => {
    // Configure the shared workflow store with soft jaws steps
    useWorkflowStore.getState().configure({
      steps: [...SOFTJAWS_WORKFLOW_STEPS],
      initialStep: 'vise-config',
    });
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <AppShell />
    </ThemeProvider>
  );
}
