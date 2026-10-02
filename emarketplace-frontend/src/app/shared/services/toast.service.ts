import { Injectable, signal } from '@angular/core';

export interface ToastEntry {
  readonly id: number;
  readonly kind: 'info' | 'success' | 'warning' | 'error';
  readonly message: string;
}

/** Minimal, dependency-free toast bus consumed by the shared toast host component. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  public readonly toasts = signal<readonly ToastEntry[]>([]);

  info(message: string): void {
    this.push('info', message);
  }

  success(message: string): void {
    this.push('success', message);
  }

  warning(message: string): void {
    this.push('warning', message);
  }

  error(message: string): void {
    this.push('error', message);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private push(kind: ToastEntry['kind'], message: string): void {
    const entry: ToastEntry = { id: this.nextId++, kind, message };
    this.toasts.update((list) => [...list, entry]);
    setTimeout(() => this.dismiss(entry.id), kind === 'error' ? 8000 : 5000);
  }
}
