import { getSupabaseClient } from './supabase';
import { updateDynamicLiveKitConfigs, LiveKitConfig } from './livekit';

export interface RemoteBroadcastNotification {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'alert' | 'update';
  active: boolean;
  actionUrl?: string;
  minVersion?: string;
  maxVersion?: string;
  createdAt: string;
}

export interface RemoteConfigPayload {
  version: string;
  minSupportedVersion: string;
  patchId?: string;
  isHotfix?: boolean;
  forceUpdate?: boolean;
  releaseNotes?: string;
  downloadUrl?: string;
  releaseUrl?: string;
  maintenanceMode: boolean;
  maintenanceNotice?: string;
  livekitServers: Array<{
    id: string;
    name: string;
    url: string;
    apiKey: string;
    apiSecret: string;
    isPrimary: boolean;
  }>;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  broadcast: RemoteBroadcastNotification | null;
  updatedAt: string;
}

let activeBroadcast: RemoteBroadcastNotification | null = null;
let isMaintenanceActive = false;
let maintenanceMessage = '';
let currentRemoteConfig: RemoteConfigPayload | null = null;
let lastBroadcastSignature = '';
let lastReleaseSignature = '';
let pollIntervalId: ReturnType<typeof setInterval> | null = null;

export function getActiveBroadcast(): RemoteBroadcastNotification | null {
  return activeBroadcast;
}

export function getMaintenanceStatus() {
  return { isMaintenanceActive, maintenanceMessage };
}

export function getLatestRemoteConfig(): RemoteConfigPayload | null {
  return currentRemoteConfig;
}

function applyRemoteConfig(config: RemoteConfigPayload) {
  if (!config) return;
  currentRemoteConfig = config;

  // 1. Update LiveKit Pool
  if (Array.isArray(config.livekitServers) && config.livekitServers.length > 0) {
    const sorted = [...config.livekitServers].sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
    const livekitConfigs: LiveKitConfig[] = sorted.map((s) => ({
      url: s.url,
      apiKey: s.apiKey,
      apiSecret: s.apiSecret,
    }));
    updateDynamicLiveKitConfigs(livekitConfigs);
  }

  // 2. Broadcast banner (only dispatch event if broadcast state/content changed)
  if (config.broadcast && config.broadcast.active) {
    activeBroadcast = config.broadcast;
  } else {
    activeBroadcast = null;
  }

  const nextBroadcastSig = activeBroadcast
    ? `${activeBroadcast.id}|${activeBroadcast.active}|${activeBroadcast.title}|${activeBroadcast.content}|${activeBroadcast.type}`
    : 'off';

  if (nextBroadcastSig !== lastBroadcastSignature) {
    lastBroadcastSignature = nextBroadcastSig;
    window.dispatchEvent(new CustomEvent('spytify:remote-broadcast', { detail: activeBroadcast }));
  }

  // 3. Maintenance mode
  isMaintenanceActive = !!config.maintenanceMode;
  maintenanceMessage = config.maintenanceNotice || '';
  window.dispatchEvent(
    new CustomEvent('spytify:remote-maintenance', {
      detail: { active: isMaintenanceActive, message: maintenanceMessage },
    })
  );

  // 4. Remote Config Updated (OTA Release / Policy)
  const nextReleaseSig = `${config.version}|${config.patchId || ''}|${config.isHotfix ? 1 : 0}|${config.forceUpdate ? 1 : 0}|${config.minSupportedVersion || ''}`;
  if (nextReleaseSig !== lastReleaseSignature) {
    lastReleaseSignature = nextReleaseSig;
    window.dispatchEvent(
      new CustomEvent('spytify:remote-config-updated', { detail: config })
    );
  }
}

/**
 * Fetch latest remote config on-demand directly from Supabase DB
 */
export async function fetchLatestRemoteConfig(): Promise<RemoteConfigPayload | null> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    // 1. Primary: read from spytify_direct_messages (id: 'remote_config_current')
    try {
      const { data: dmData } = await supabase
        .from('spytify_direct_messages')
        .select('content')
        .eq('id', 'remote_config_current')
        .maybeSingle();

      if (dmData?.content) {
        const parsed = typeof dmData.content === 'string' ? JSON.parse(dmData.content) : dmData.content;
        if (parsed && parsed.version) {
          applyRemoteConfig(parsed as RemoteConfigPayload);
          return parsed as RemoteConfigPayload;
        }
      }
    } catch {}

    // 2. Secondary fallback: app_remote_config table
    const { data, error } = await supabase
      .from('app_remote_config')
      .select('config_data')
      .eq('id', 'current')
      .maybeSingle();

    if (!error && data?.config_data) {
      const cfg = data.config_data as RemoteConfigPayload;
      applyRemoteConfig(cfg);
      return cfg;
    }
  } catch (err) {
    console.warn('[RemoteConfig] fetchLatestRemoteConfig error:', err);
  }
  return null;
}

/**
 * Initialize remote config sync via Supabase Realtime Broadcast, Postgres Changes & Periodic Poll
 */
export async function initRemoteConfigSync() {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    // 1. Query initial config immediately
    await fetchLatestRemoteConfig();

    // 2. Subscribe to Realtime Broadcast channel + Postgres DB changes on spytify_direct_messages
    const channel = supabase.channel('spytify_system_remote_config');
    channel
      .on('broadcast', { event: 'config_updated' }, (message) => {
        if (message.payload) {
          console.log('[RemoteConfig] Received real-time broadcast config from Admin:', message.payload);
          applyRemoteConfig(message.payload as RemoteConfigPayload);
        }
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'spytify_direct_messages',
          filter: 'id=eq.remote_config_current',
        },
        (payload: any) => {
          try {
            const raw = payload?.new?.content;
            if (raw) {
              const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
              if (parsed && parsed.version) {
                console.log('[RemoteConfig] Received real-time DB config update from Admin:', parsed);
                applyRemoteConfig(parsed as RemoteConfigPayload);
              }
            }
          } catch {}
        }
      )
      .subscribe();

    // 3. Fallback periodic poll every 15s so notifications & hotfixes always arrive even if WebSocket reconnects
    if (pollIntervalId) clearInterval(pollIntervalId);
    pollIntervalId = setInterval(() => {
      fetchLatestRemoteConfig().catch(() => {});
    }, 15000);
  } catch (err) {
    console.warn('[RemoteConfig] Failed to init remote config listener:', err);
  }
}
