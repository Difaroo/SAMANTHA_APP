import { Network, type ConnectionStatus } from '@capacitor/network';
import type { PluginListenerHandle } from '@capacitor/core';
import { useEntityStore } from '../stores/entityStore';
import {
  SYNC_SCHEMA_VERSION,
  SyncResponseSchema,
  type SyncMutation,
} from '../sync/contract';

const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:3333').replace(/\/$/, '');
const SYNC_URL = `${API_BASE}/api/v1/sync`;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_BATCH_SIZE = 100;

function getDeviceId() {
  const key = 'samantha-sync-device-id';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const deviceId = `samantha-mobile-${suffix}`;
  localStorage.setItem(key, deviceId);
  return deviceId;
}

export class SyncManager {
  private static initPromise: Promise<void> | null = null;
  private static inFlight: Promise<void> | null = null;
  private static networkListener: PluginListenerHandle | null = null;
  private static unsubscribeStore: (() => void) | null = null;
  private static retryTimer: ReturnType<typeof setTimeout> | null = null;
  private static retryAttempt = 0;
  private static rerun = false;
  private static onlineListenerInstalled = false;
  private static lifecycleListenerInstalled = false;

  static async init() {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      await this.waitForHydration();
      this.installStoreSubscription();
      await this.installConnectivityListeners();
      this.installLifecycleListeners();
      await this.syncNow();
    })();
    return this.initPromise;
  }

  private static waitForHydration() {
    if (useEntityStore.persist.hasHydrated()) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const unsubscribe = useEntityStore.persist.onFinishHydration(() => {
        unsubscribe();
        resolve();
      });
    });
  }

  private static installStoreSubscription() {
    if (this.unsubscribeStore) return;
    let previousSignature = '';
    this.unsubscribeStore = useEntityStore.subscribe((state) => {
      const signature = state.outbox.map((mutation) => `${mutation.id}:${JSON.stringify(mutation.value)}`).join('|');
      if (signature !== previousSignature) {
        previousSignature = signature;
        if (state.outbox.length) this.scheduleSync(50);
      }
    });
  }

  private static async installConnectivityListeners() {
    if (!this.networkListener) {
      try {
        this.networkListener = await Network.addListener(
          'networkStatusChange',
          (status: ConnectionStatus) => {
            if (status.connected) this.scheduleSync(0);
            else useEntityStore.getState().setSyncStatus('offline', 'Changes are saved on this device');
          },
        );
      } catch {
        // Browser mode uses online/offline events below.
      }
    }

    if (!this.onlineListenerInstalled && typeof window !== 'undefined') {
      window.addEventListener('online', () => this.scheduleSync(0));
      window.addEventListener('offline', () => {
        useEntityStore.getState().setSyncStatus('offline', 'Changes are saved on this device');
      });
      this.onlineListenerInstalled = true;
    }
  }

  private static installLifecycleListeners() {
    if (this.lifecycleListenerInstalled || typeof window === 'undefined') return;
    window.addEventListener('focus', () => this.scheduleSync(0));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.scheduleSync(0);
    });
    this.lifecycleListenerInstalled = true;
  }

  private static scheduleSync(delayMs: number) {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.syncNow();
    }, delayMs);
  }

  private static scheduleRetry() {
    const base = Math.min(30_000, 1000 * (2 ** this.retryAttempt));
    this.retryAttempt += 1;
    this.scheduleSync(base + Math.floor(Math.random() * 500));
  }

  static async syncNow() {
    if (this.inFlight) {
      this.rerun = true;
      return this.inFlight;
    }

    this.inFlight = this.runSyncLoop();
    try {
      await this.inFlight;
    } finally {
      this.inFlight = null;
      if (this.rerun) {
        this.rerun = false;
        this.scheduleSync(0);
      }
    }
  }

  private static async runSyncLoop() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      useEntityStore.getState().setSyncStatus('offline', 'Changes are saved on this device');
      return;
    }

    do {
      const state = useEntityStore.getState();
      const sent = state.outbox.slice(0, MAX_BATCH_SIZE);
      state.setSyncStatus('syncing', sent.length ? 'Sending saved changes' : 'Checking PRISM');
      try {
        const response = await this.postSync(sent, state.serverRevision);
        useEntityStore.getState().applySyncResponse(response, sent);
        this.retryAttempt = 0;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown sync error';
        useEntityStore.getState().setSyncStatus(
          typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error',
          message,
        );
        this.scheduleRetry();
        return;
      }
    } while (useEntityStore.getState().outbox.length > 0);
  }

  private static async postSync(mutations: SyncMutation[], cursor: number) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemaVersion: SYNC_SCHEMA_VERSION,
          deviceId: getDeviceId(),
          cursor,
          mutations,
        }),
        signal: controller.signal,
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error || `PRISM sync failed (${response.status})`);
      }
      return SyncResponseSchema.parse(body);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('PRISM sync timed out', { cause: error });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  static fetchSeed() {
    return this.syncNow();
  }

  static pushState() {
    return this.syncNow();
  }
}
