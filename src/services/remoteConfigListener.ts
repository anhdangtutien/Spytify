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

export function getActiveBroadcast(): RemoteBroadcastNotification | null {
  return activeBroadcast;
}

export function getMaintenanceStatus() {
  return { isMaintenanceActive, maintenanceMessage };
}

function applyRemoteConfig(config: RemoteConfigPayload) {
  if (!config) return;

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
}

/**
 * Initialize remote config sync via Supabase Realtime & DB
 */
export async function initRemoteConfigSync() {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    // 1. Query initial config if table exists
    try {
      const { data, error } = await supabase
        .from('app_remote_config')
        .select('config_data')
        .eq('id', 'current')
        .single();

      if (!error && data?.config_data) {
        applyRemoteConfig(data.config_data as RemoteConfigPayload);
      }
    } catch {}

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
