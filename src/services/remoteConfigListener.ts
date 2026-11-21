import { getSupabaseClient } from './supabase';
import { updateDynamicLiveKitConfigs, LiveKitConfig } from './livekit';

export interface RemoteBroadcastNotification {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'alert' | 'update';
  active: boolean;
  actionUrl?: string;
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
    // Sort so primary comes first
    const sorted = [...config.livekitServers].sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
    const livekitConfigs: LiveKitConfig[] = sorted.map((s) => ({
      url: s.url,
      apiKey: s.apiKey,
      apiSecret: s.apiSecret,
    }));
    updateDynamicLiveKitConfigs(livekitConfigs);
  }

  // 2. Broadcast banner
  if (config.broadcast && config.broadcast.active) {
    activeBroadcast = config.broadcast;
  } else {
    activeBroadcast = null;
  }
  window.dispatchEvent(new CustomEvent('spytify:remote-broadcast', { detail: activeBroadcast }));

  // 3. Maintenance mode
  isMaintenanceActive = !!config.maintenanceMode;
  maintenanceMessage = config.maintenanceNotice || '';
  window.dispatchEvent(
    new CustomEvent('spytify:remote-maintenance', {
      detail: { active: isMaintenanceActive, message: maintenanceMessage },
    })
  );

  // 4. Remote Config Updated (OTA Release / Policy)
  window.dispatchEvent(
    new CustomEvent('spytify:remote-config-updated', { detail: config })
  );
}

/**
 * Fetch latest remote config on-demand directly from Supabase DB
 */
export async function fetchLatestRemoteConfig(): Promise<RemoteConfigPayload | null> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    // 1. Primary: read from spytify_direct_messages (room_id: 'spytify_system_remote_config')
    try {
      const { data: dmData } = await supabase
        .from('spytify_direct_messages')
        .select('content')
        .eq('id', 'remote_config_current')
        .maybeSingle();

      if (dmData?.content) {
        const parsed = JSON.parse(dmData.content);
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
 * Initialize remote config sync via Supabase Realtime & DB
 */
export async function initRemoteConfigSync() {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    // 1. Query initial config
    await fetchLatestRemoteConfig();

    // 2. Subscribe to Realtime Broadcast channel
    const channel = supabase.channel('spytify_system_remote_config');
    channel
      .on('broadcast', { event: 'config_updated' }, (message) => {
        if (message.payload) {
          console.log('[RemoteConfig] Received real-time config update from Admin:', message.payload);
          applyRemoteConfig(message.payload as RemoteConfigPayload);
        }
      })
      .subscribe();
  } catch (err) {
    console.warn('[RemoteConfig] Failed to init remote config listener:', err);
  }
}
