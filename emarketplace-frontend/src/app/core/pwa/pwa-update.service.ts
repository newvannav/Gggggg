import { Injectable, NgZone, inject, signal } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';
import { ToastService } from '../../shared/services/toast.service';

export type UpdatePromptState = 'idle' | 'pending' | 'installing' | 'installed';

/**
 * Owns the entire service-worker lifecycle:
 *  - checks for a new app version on startup and on an interval
 *  - surfaces a modern UI prompt when a `VersionReadyEvent` fires
 *  - activates the waiting worker and forces an immediate hydration reload
 */
@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly zone = inject(NgZone);
  private readonly toast = inject(ToastService);

  /** Exposed to the update-notification component via signals — no subscriptions needed. */
  public readonly state = signal<UpdatePromptState>('idle');
  public readonly pendingVersionHash = signal<string | null>(null);

  private static readonly CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly drift check

  constructor() {
    if (!this.swUpdate.isEnabled) {
      // Dev server / SSR prerender pass — nothing to do.
      return;
    }

    this.zone.runOutsideAngular(() => {
      // 1. Listen for the SW announcing a freshly cached (waiting) version.
      this.swUpdate.versionUpdates
        .pipe(filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'))
        .subscribe((evt) => {
          this.zone.run(() => {
            this.pendingVersionHash.set(evt.latestVersion.hash);
            this.state.set('pending');
          });
        });

      // 2. React to hard-recovery events (e.g. corrupted cache after a bad deploy):
      // if the SW reports an unrecoverable state, force-clean and reload so the
      // customer is never stuck on a broken offline shell.
      this.swUpdate.unrecoverable
        .subscribe(() =>
          this.zone.run(async () => {
            await this.swUpdate.activateUpdate();
            document.location.reload();
          }),
        );

      // 3. Proactive checks: immediately on boot, then hourly.
      void this.checkForUpdate();
      setInterval(() => void this.checkForUpdate(), PwaUpdateService.CHECK_INTERVAL_MS);
    });
  }

  /** Prompt CTA: install the waiting worker, then force hydration reload. */
  public async applyUpdate(): Promise<void> {
    if (this.state() !== 'pending') {
      return;
    }
    this.state.set('installing');
    await this.activateAndReload();
  }

  /** Dismiss — keep serving the current version; we'll re-prompt next check. */
  public dismissUpdate(): void {
    this.state.set('idle');
    this.pendingVersionHash.set(null);
  }

  private async checkForUpdate(): Promise<void> {
    try {
      // checkForUpdate() resolves false when no new manifest is detected —
      // the versionUpdates stream is what actually announces VERSION_READY.
      await this.swUpdate.checkForUpdate();
    } catch {
      // Offline or SW endpoint unreachable — silently ignore; freshness retries later.
    }
  }

  private async activateAndReload(): Promise<void> {
    try {
      // activateUpdate() resolves once the waiting worker has taken control;
      // it rejects if installation failed (e.g. partial download).
      await this.swUpdate.activateUpdate();
    } catch {
      this.toast.error('Update could not be installed. It will retry shortly.');
      this.state.set('idle');
      return;
    }
    this.state.set('installed');
    // Full document reload so the new index.html + hashed bundles hydrate cleanly.
    document.location.reload();
  }
}
