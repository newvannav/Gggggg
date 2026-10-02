import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PwaUpdateService } from '../../../core/pwa/pwa-update.service';

/**
 * Modern bottom-sheet prompt shown when the service worker has a new app version
 * waiting. Driven entirely by PwaUpdateService signals — zero imperative wiring.
 */
@Component({
  selector: 'app-update-notification',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `@if (updates.state() === 'pending') {
    <div class="update-snackbar" role="alertdialog" aria-live="assertive">
      <div class="update-snackbar__body">
        <span class="update-snackbar__dot" aria-hidden="true"></span>
        <div>
          <strong>A new version is ready.</strong>
          <p>
            Update now for the latest features &amp; fixes
            @if (updates.pendingVersionHash(); as hash) {
              <code class="update-snackbar__hash">#{{ hash.slice(0, 8) }}</code>
            }
          </p>
        </div>
      </div>
      <div class="update-snackbar__actions">
        <button type="button" class="btn btn--ghost" (click)="updates.dismissUpdate()">Later</button>
        <button type="button" class="btn btn--primary" (click)="updates.applyUpdate()">Update now</button>
      </div>
    </div>
  } @else if (updates.state() === 'installing') {
    <div class="update-snackbar update-snackbar--busy" role="status" aria-live="polite">
      Installing update…
    </div>
  }`,
  styles: `
    :host { position: fixed; inset-inline: 0; bottom: 0; z-index: 1200; display: block; pointer-events: none; }
    .update-snackbar {
      pointer-events: auto;
      margin: 0 auto 16px; max-width: 560px; width: calc(100% - 32px);
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      padding: 14px 18px; border-radius: 14px;
      background: #101418; color: #f5f7fa; box-shadow: 0 12px 32px rgba(0,0,0,.35);
      animation: slide-up .28s cubic-bezier(.2,.8,.2,1);
    }
    .update-snackbar--busy { justify-content: center; font-weight: 600; }
    .update-snackbar__body { display: flex; align-items: flex-start; gap: 12px; }
    .update-snackbar__body p { margin: 2px 0 0; opacity: .8; font-size: 13px; }
    .update-snackbar__dot { width: 10px; height: 10px; margin-top: 5px; border-radius: 50%; background: #29d38a; flex: none; }
    .update-snackbar__hash { opacity: .55; font-size: 11px; }
    .update-snackbar__actions { display: flex; gap: 8px; flex: none; }
    .btn { border: 0; border-radius: 9px; padding: 8px 14px; font: inherit; font-weight: 600; cursor: pointer; }
    .btn--primary { background: #29d38a; color: #06231a; }
    .btn--ghost { background: transparent; color: #cfd6dd; }
    @keyframes slide-up { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
  `,
})
export class UpdateNotificationComponent {
  protected readonly updates = inject(PwaUpdateService);
}
