/**
 * Custom events for cross-component communication
 * (3D scene ↔ UI panels without prop drilling)
 */

type EventCallback = (...args: unknown[]) => void;

class EventBus {
  private listeners = new Map<string, Set<EventCallback>>();

  on(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  emit(event: string, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach((cb) => cb(...args));
  }

  off(event: string, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const appEvents = new EventBus();

// Event name constants
export const EVENTS = {
  PART_IMPORTED: 'part:imported',
  PART_SELECTED: 'part:selected',
  JAW_UPDATED: 'jaw:updated',
  CAVITY_GENERATED: 'cavity:generated',
  VIEWPORT_RESET: 'viewport:reset',
  VIEWPORT_FIT: 'viewport:fit',
} as const;
