import { getSupabaseClient } from './supabase';
import { Track } from '../types';

export interface ConnectPlaybackState {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  repeatMode?: 'off' | 'all' | 'one';
  isShuffle?: boolean;
  activeDeviceId?: string;
  activeDeviceName?: string;
  lanStreamBaseUrl?: string | null;
  timestamp: number;
}

export type ConnectCommand =
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'TOGGLE_PLAY' }
  | { type: 'NEXT' }
  | { type: 'PREV' }
  | { type: 'SEEK'; time: number }
  | { type: 'SET_VOLUME'; volume: number }
  | { type: 'PLAY_TRACK'; track: Track }
  | { type: 'TRANSFER_PLAYBACK'; target: 'desktop' | 'mobile'; currentTime?: number }
  | { type: 'REQUEST_STATE' };

export type StateCallback = (state: ConnectPlaybackState) => void;
export type CommandCallback = (cmd: ConnectCommand) => void;
export type StatusCallback = (active: boolean) => void;

class SpytifyConnectService {
  private realtimeChannel: any = null;
  private hubChannel: any = null;
  private activeUserId: string | null = null;
  private discoveredHostId: string | null = null;
  private discoveredHostName: string = 'Spytify Desktop';

  private isHostRunning = false;
  private isClientConnected = false;
  private isHostOnline = false;

  private onStateCallbacks: Set<StateCallback> = new Set();
  private onCommandCallbacks: Set<CommandCallback> = new Set();
  private onHostStatusCallbacks: Set<StatusCallback> = new Set();
  private onClientStatusCallbacks: Set<StatusCallback> = new Set();

  private lastState: ConnectPlaybackState | null = null;
  private lastBroadcastTime = 0;

  // ──────────────────────────────────────────────────────────────────────────
  // DESKTOP HOST METHODS (Direction 1 & 3: Master Broadcaster & Sync Engine)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Starts the Desktop Host on Supabase Realtime channel.
   * Enables instant remote control from iPhone with sub-50ms latency.
   */
  public async startHost(
    userId: string,
    onCommand?: CommandCallback,
    hostDeviceName = 'Spytify Desktop'
  ): Promise<boolean> {
    if (this.isHostRunning && this.activeUserId === userId) {
      return true;
    }

    await this.stopHost();
    this.activeUserId = userId;
    this.discoveredHostName = hostDeviceName;

    if (onCommand) {
      this.onCommandCallbacks.add(onCommand);
    }

    const client = getSupabaseClient();
    if (!client) {
      console.warn('[Spytify Connect] Supabase client is not available');
      return false;
    }

    try {
      const channelName = `spytify_remote_${userId}`;
      const existingRemote = client.getChannels().find((c: any) => c.topic === `realtime:${channelName}`);
      if (existingRemote) {
        try { client.removeChannel(existingRemote); } catch {}
      }

      this.realtimeChannel = client.channel(channelName, {
        config: { broadcast: { self: false }, presence: { key: `desktop_${userId}` } },
      });

      this.realtimeChannel
        .on('broadcast', { event: 'remote_cmd' }, ({ payload }: { payload: ConnectCommand }) => {
          if (!payload) return;
          console.log('[Spytify Connect] Host received command:', payload);
          if (payload.type === 'REQUEST_STATE' && this.lastState) {
            this.broadcastPlaybackState(this.lastState, true);
            return;
          }
          this.onCommandCallbacks.forEach(cb => cb(payload));
        })
        .subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED' && this.realtimeChannel) {
            await this.realtimeChannel.track({
              role: 'host',
              userId,
              name: hostDeviceName,
              onlineAt: Date.now(),
            });
          }
        });

      // Announce on global hub channel for zero-config auto-pairing and listen for commands
      const existingHub = client.getChannels().find((c: any) => c.topic === 'realtime:spytify_connect_hub');
      if (existingHub) {
        try { client.removeChannel(existingHub); } catch {}
      }
      this.hubChannel = client.channel('spytify_connect_hub', {
        config: { broadcast: { self: false }, presence: { key: `hub_${userId}` } },
      });

      this.hubChannel
        .on('broadcast', { event: 'remote_cmd' }, ({ payload }: { payload: ConnectCommand }) => {
          if (!payload) return;
          console.log('[Spytify Connect] Host received command via hub:', payload);
          if (payload.type === 'REQUEST_STATE' && this.lastState) {
            this.broadcastPlaybackState(this.lastState, true);
            return;
          }
          this.onCommandCallbacks.forEach(cb => cb(payload));
        })
        .subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED' && this.hubChannel) {
            await this.hubChannel.track({
              role: 'host',
              hostId: userId,
              name: hostDeviceName,
              onlineAt: Date.now(),
            });
            this.hubChannel.send({
              type: 'broadcast',
              event: 'host_online',
              payload: { hostId: userId, name: hostDeviceName, timestamp: Date.now() },
            }).catch(() => {});
          }
        });

      this.isHostRunning = true;
      this.notifyHostStatus(true);
      return true;
    } catch (err) {
      console.error('[Spytify Connect] Failed to start Host:', err);
      await this.stopHost();
      return false;
    }
  }

  public async stopHost(): Promise<void> {
    this.isHostRunning = false;
    this.notifyHostStatus(false);

    const client = getSupabaseClient();
    if (client) {
      if (this.realtimeChannel) {
        try { client.removeChannel(this.realtimeChannel); } catch {}
        this.realtimeChannel = null;
      }
      if (this.hubChannel) {
        try { client.removeChannel(this.hubChannel); } catch {}
        this.hubChannel = null;
      }
    }
  }

  /**
   * Broadcasts the current playback state from Desktop to Mobile clients.
   * Throttles regular time ticks to reduce network traffic, but sends state changes immediately.
   */
  public broadcastPlaybackState(state: ConnectPlaybackState, force = false): void {
    this.lastState = state;
    if (!this.isHostRunning) return;

    const now = Date.now();
    if (!force && (now - this.lastBroadcastTime < 800)) {
      return;
    }
    this.lastBroadcastTime = now;

    if (this.realtimeChannel) {
      this.realtimeChannel.send({
        type: 'broadcast',
        event: 'state_update',
        payload: state,
      }).catch(() => {});
    }

    if (this.hubChannel) {
      this.hubChannel.send({
        type: 'broadcast',
        event: 'state_update',
        payload: state,
      }).catch(() => {});
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // MOBILE / IPHONE CLIENT METHODS (Remote Control & Playback Handover)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Connects as Mobile Client:
   * Instantly binds to Desktop Host for remote control and state sync.
   */
  public async connectAsClient(
    userId: string,
    onState?: StateCallback
  ): Promise<boolean> {
    if (onState) {
      this.onStateCallbacks.add(onState);
    }

    const client = getSupabaseClient();
    if (!client) {
      console.warn('[Spytify Connect] Supabase client is not available');
      return false;
    }

    try {
      this.activeUserId = userId;
      const targetUserId = (userId === 'guest_user' && this.discoveredHostId) ? this.discoveredHostId : userId;

      await this.disconnectClient();

      // Channel 1: Dedicated user channel
      const channelName = `spytify_remote_${targetUserId}`;
      const existing = client.getChannels().find((c: any) => c.topic === `realtime:${channelName}`);
      if (existing) {
        try { client.removeChannel(existing); } catch {}
      }

      this.realtimeChannel = client.channel(channelName, {
        config: { broadcast: { self: false } },
      });

      this.realtimeChannel
        .on('broadcast', { event: 'state_update' }, ({ payload }: { payload: ConnectPlaybackState }) => {
          if (!payload) return;
          this.lastState = payload;
          this.isHostOnline = true;
          this.notifyHostStatus(true);
          this.onStateCallbacks.forEach(cb => cb(payload));
        })
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            this.sendRemoteCommand({ type: 'REQUEST_STATE' });
          }
        });

      // Channel 2: Shared discovery & control hub
      let existingHub = client.getChannels().find((c: any) => c.topic === 'realtime:spytify_connect_hub');
      if (!existingHub) {
        this.hubChannel = client.channel('spytify_connect_hub', {
          config: { broadcast: { self: false } },
        });
        this.hubChannel
          .on('broadcast', { event: 'state_update' }, ({ payload }: { payload: ConnectPlaybackState }) => {
            if (!payload) return;
            this.lastState = payload;
            this.isHostOnline = true;
            this.notifyHostStatus(true);
            this.onStateCallbacks.forEach(cb => cb(payload));
          })
          .on('broadcast', { event: 'host_online' }, ({ payload }: { payload: { hostId: string; name?: string } }) => {
            if (payload?.hostId) {
              this.discoveredHostId = payload.hostId;
              if (payload.name) this.discoveredHostName = payload.name;
              this.isHostOnline = true;
              this.notifyHostStatus(true);
            }
          })
          .subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              this.sendRemoteCommand({ type: 'REQUEST_STATE' });
            }
          });
      } else {
        this.hubChannel = existingHub;
      }

      this.isClientConnected = true;
      this.notifyClientStatus(true);
      return true;
    } catch (err) {
      console.error('[Spytify Connect] Failed to connect as client:', err);
      await this.disconnectClient();
      return false;
    }
  }

  public async connectClient(userId: string, onState?: StateCallback): Promise<boolean> {
    return this.connectAsClient(userId, onState);
  }

  public async disconnectClient(): Promise<void> {
    this.isClientConnected = false;
    this.notifyClientStatus(false);

    const client = getSupabaseClient();
    if (client && this.realtimeChannel) {
      try { client.removeChannel(this.realtimeChannel); } catch {}
      this.realtimeChannel = null;
    }
  }

  /**
   * Sends a remote control command from Mobile to Desktop Host (Play, Pause, Next, Prev, Seek, Volume).
   */
  public sendRemoteCommand(cmd: ConnectCommand): void {
    const client = getSupabaseClient();
    if (!client) return;

    if (this.realtimeChannel) {
      this.realtimeChannel.send({
        type: 'broadcast',
        event: 'remote_cmd',
        payload: cmd,
      }).catch((err: any) => {
        console.warn('[Spytify Connect] Send remote command failed on user channel:', err);
      });
    }

    if (this.hubChannel) {
      this.hubChannel.send({
        type: 'broadcast',
        event: 'remote_cmd',
        payload: cmd,
      }).catch((err: any) => {
        console.warn('[Spytify Connect] Send remote command failed on hub:', err);
      });
    } else {
      let hub: any = client.getChannels().find((c: any) => c.topic === 'realtime:spytify_connect_hub');
      if (!hub) {
        const newHub = client.channel('spytify_connect_hub', {
          config: { broadcast: { self: false } },
        });
        newHub.subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            newHub.send({
              type: 'broadcast',
              event: 'remote_cmd',
              payload: cmd,
            }).catch(() => {});
          }
        });
      } else {
        hub.send({
          type: 'broadcast',
          event: 'remote_cmd',
          payload: cmd,
        }).catch(() => {});
      }
    }
  }

  public sendCommand(cmd: ConnectCommand): void {
    this.sendRemoteCommand(cmd);
  }

  public resumeAudio(): void {
    // Kept for backward compatibility
  }

  /**
   * Subscribes to host presence updates (to know if Desktop is online without connecting).
   */
  public monitorHostOnline(userId: string, onHostStatus: StatusCallback): () => void {
    this.onHostStatusCallbacks.add(onHostStatus);
    onHostStatus(this.isHostOnline);

    const client = getSupabaseClient();
    if (!client) return () => {};

    try {
      // Connect to shared hub channel
      let hub: any = client.getChannels().find((c: any) => c.topic === 'realtime:spytify_connect_hub');
      if (!hub) {
        const newHub = client.channel('spytify_connect_hub', {
          config: { broadcast: { self: false } },
        });

        newHub
          .on('broadcast', { event: 'host_online' }, ({ payload }: { payload: { hostId: string; name?: string } }) => {
            if (payload?.hostId) {
              this.discoveredHostId = payload.hostId;
              if (payload.name) this.discoveredHostName = payload.name;
              this.isHostOnline = true;
              this.notifyHostStatus(true);
            }
          })
          .on('broadcast', { event: 'state_update' }, ({ payload }: { payload: ConnectPlaybackState }) => {
            if (payload) {
              this.lastState = payload;
              this.isHostOnline = true;
              this.notifyHostStatus(true);
              this.onStateCallbacks.forEach(cb => cb(payload));
            }
          })
          .on('presence', { event: 'sync' }, () => {
            try {
              const state = newHub.presenceState();
              let foundHostId: string | null = null;
              let foundName = 'Spytify Desktop';
              for (const presences of Object.values(state)) {
                if (Array.isArray(presences)) {
                  const h = presences.find((p: any) => p && p.role === 'host') as any;
                  if (h) {
                    foundHostId = h.hostId || h.userId;
                    if (h.name) foundName = h.name;
                    break;
                  }
                }
              }
              const hasHost = !!foundHostId;
              if (hasHost) {
                this.discoveredHostId = foundHostId;
                this.discoveredHostName = foundName;
              }
              this.isHostOnline = hasHost;
              this.notifyHostStatus(hasHost);
            } catch {}
          })
          .subscribe();
      }

      return () => {
        this.onHostStatusCallbacks.delete(onHostStatus);
      };
    } catch (err) {
      console.warn('[Spytify Connect] monitorHostOnline error:', err);
      return () => {
        this.onHostStatusCallbacks.delete(onHostStatus);
      };
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // GETTERS & LISTENERS
  // ──────────────────────────────────────────────────────────────────────────

  public getIsHostRunning(): boolean {
    return this.isHostRunning;
  }

  public getIsClientConnected(): boolean {
    return this.isClientConnected;
  }

  public getIsHostOnline(): boolean {
    return this.isHostOnline;
  }

  public getHostName(): string {
    return this.discoveredHostName || 'Spytify Desktop';
  }

  public getLastState(): ConnectPlaybackState | null {
    return this.lastState;
  }

  public addStateListener(cb: StateCallback): () => void {
    this.onStateCallbacks.add(cb);
    if (this.lastState) cb(this.lastState);
    return () => this.onStateCallbacks.delete(cb);
  }

  public addCommandListener(cb: CommandCallback): () => void {
    this.onCommandCallbacks.add(cb);
    return () => this.onCommandCallbacks.delete(cb);
  }

  public addHostStatusListener(cb: StatusCallback): () => void {
    this.onHostStatusCallbacks.add(cb);
    cb(this.isHostRunning || this.isHostOnline);
    return () => this.onHostStatusCallbacks.delete(cb);
  }

  public addClientStatusListener(cb: StatusCallback): () => void {
    this.onClientStatusCallbacks.add(cb);
    cb(this.isClientConnected);
    return () => this.onClientStatusCallbacks.delete(cb);
  }

  private notifyHostStatus(active: boolean) {
    this.onHostStatusCallbacks.forEach(cb => cb(active));
  }

  private notifyClientStatus(active: boolean) {
    this.onClientStatusCallbacks.forEach(cb => cb(active));
  }
}

export const spytifyConnect = new SpytifyConnectService();
