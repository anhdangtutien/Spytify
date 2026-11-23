import {
  Room,
  RoomEvent,
  LocalAudioTrack,
  Track as LKTrack,
  RemoteTrack,
  RemoteAudioTrack,
  RemoteParticipant,
} from 'livekit-client';
import { createLiveKitToken } from './livekit';
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
  | { type: 'REQUEST_STATE' };

export type StateCallback = (state: ConnectPlaybackState) => void;
export type CommandCallback = (cmd: ConnectCommand) => void;
export type StatusCallback = (active: boolean) => void;

class SpytifyConnectService {
  private hostRoom: Room | null = null;
  private clientRoom: Room | null = null;
  private localAudioTrack: LocalAudioTrack | null = null;
  private realtimeChannel: any = null;
  private activeUserId: string | null = null;

  private isHostRunning = false;
  private isClientConnected = false;
  private isHostOnline = false;

  private onStateCallbacks: Set<StateCallback> = new Set();
  private onCommandCallbacks: Set<CommandCallback> = new Set();
  private onHostStatusCallbacks: Set<StatusCallback> = new Set();
  private onClientStatusCallbacks: Set<StatusCallback> = new Set();

  private lastState: ConnectPlaybackState | null = null;
  private audioAttachedElement: HTMLAudioElement | null = null;

  // ──────────────────────────────────────────────────────────────────────────
  // DESKTOP HOST METHODS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Starts the Desktop Host:
   * 1. Publishes the master audio stream into LiveKit room `spytify_connect_${userId}`.
   * 2. Listens for remote control commands on Supabase Realtime channel `connect_${userId}`.
   */
  public async startHost(
    userId: string,
    audioStream: MediaStream | null,
    onCommand?: CommandCallback
  ): Promise<boolean> {
    if (this.isHostRunning && this.activeUserId === userId) {
      return true;
    }

    await this.stopHost();
    this.activeUserId = userId;

    if (onCommand) {
      this.onCommandCallbacks.add(onCommand);
    }

    try {
      const roomName = `spytify_connect_${userId}`;
      const { token, serverUrl } = await createLiveKitToken(roomName, `desktop_${userId}`, 'Desktop Host');

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      await room.connect(serverUrl, token);
      this.hostRoom = room;

      // Extract master audio track from MediaStream and publish as High-Fidelity Music Track
      const audioTrack = audioStream ? audioStream.getAudioTracks()[0] : null;
      if (audioTrack) {
        this.localAudioTrack = new LocalAudioTrack(audioTrack);
        await room.localParticipant.publishTrack(this.localAudioTrack, {
          name: 'spytify-master-music',
          source: LKTrack.Source.Microphone,
          simulcast: false,
        });
        console.log('[Spytify Connect] Published master audio track to LiveKit room:', roomName);
      } else {
        console.warn('[Spytify Connect] Host started without audio track, signaling is active.');
      }

      // Connect to Supabase Realtime for control signaling
      this.initHostRealtime(userId);

      this.isHostRunning = true;
      this.notifyHostStatus(true);
      return true;
    } catch (err) {
      console.error('[Spytify Connect] Failed to start Host:', err);
      await this.stopHost();
      return false;
    }
  }

  /**
   * Stops Desktop Host and cleans up LiveKit + Supabase channels.
   */
  public async stopHost(): Promise<void> {
    this.isHostRunning = false;
    this.notifyHostStatus(false);

    if (this.localAudioTrack) {
      try {
        this.localAudioTrack.stop();
      } catch {}
      this.localAudioTrack = null;
    }

    if (this.hostRoom) {
      try {
        await this.hostRoom.disconnect();
      } catch {}
      this.hostRoom = null;
    }

    if (this.realtimeChannel) {
      try {
        const client = getSupabaseClient();
        if (client) {
          client.removeChannel(this.realtimeChannel);
        }
      } catch {}
      this.realtimeChannel = null;
    }
  }

  /**
   * Broadcasts the current playback state from Desktop to Mobile clients.
   */
  public broadcastPlaybackState(state: ConnectPlaybackState): void {
    this.lastState = state;
    if (!this.realtimeChannel || !this.isHostRunning) return;

    this.realtimeChannel.send({
      type: 'broadcast',
      event: 'state_update',
      payload: state,
    }).catch(() => {});
  }

  private initHostRealtime(userId: string) {
    const client = getSupabaseClient();
    if (!client) return;

    const channelName = `spytify_remote_${userId}`;
    this.realtimeChannel = client.channel(channelName, {
      config: { broadcast: { self: false }, presence: { key: `desktop_${userId}` } },
    });

    this.realtimeChannel
      .on('broadcast', { event: 'remote_cmd' }, ({ payload }: { payload: ConnectCommand }) => {
        if (!payload) return;
        if (payload.type === 'REQUEST_STATE' && this.lastState) {
          this.broadcastPlaybackState(this.lastState);
          return;
        }
        this.onCommandCallbacks.forEach(cb => cb(payload));
      })
      .on('presence', { event: 'sync' }, () => {
        // Track presence
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED' && this.realtimeChannel) {
          await this.realtimeChannel.track({
            role: 'host',
            userId,
            onlineAt: Date.now(),
          });
        }
      });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // MOBILE / IPHONE CLIENT METHODS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Connects as a Mobile Client:
   * 1. Subscribes to Supabase Realtime channel to receive state and send commands.
   * 2. Connects to LiveKit room to receive and play the high-fidelity audio stream.
   */
  public async connectAsClient(
    userId: string,
    onState?: StateCallback,
    targetAudioElement?: HTMLAudioElement
  ): Promise<boolean> {
    if (this.isClientConnected && this.activeUserId === userId) {
      return true;
    }

    await this.disconnectClient();
    this.activeUserId = userId;

    if (onState) {
      this.onStateCallbacks.add(onState);
    }
    if (targetAudioElement) {
      this.audioAttachedElement = targetAudioElement;
    }

    try {
      const roomName = `spytify_connect_${userId}`;
      const { token, serverUrl } = await createLiveKitToken(
        roomName,
        `mobile_${Date.now()}`,
        'iPhone Client'
      );

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication, participant: RemoteParticipant) => {
        if (track.kind === LKTrack.Kind.Audio) {
          console.log('[Spytify Connect] Audio track received from Host:', participant.identity);
          if (this.audioAttachedElement) {
            track.attach(this.audioAttachedElement);
          } else {
            const el = track.attach();
            el.setAttribute('playsinline', 'true');
            el.setAttribute('webkit-playsinline', 'true');
            this.audioAttachedElement = el;
          }
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        track.detach();
      });

      room.on(RoomEvent.Disconnected, () => {
        this.isClientConnected = false;
        this.notifyClientStatus(false);
      });

      await room.connect(serverUrl, token);
      this.clientRoom = room;

      // Connect to Supabase Realtime for remote control
      this.initClientRealtime(userId);

      this.isClientConnected = true;
      this.notifyClientStatus(true);

      // Request immediate state from Host
      this.sendRemoteCommand({ type: 'REQUEST_STATE' });
      return true;
    } catch (err) {
      console.error('[Spytify Connect] Failed to connect as Client:', err);
      await this.disconnectClient();
      return false;
    }
  }

  /**
   * Disconnects Mobile Client from LiveKit and Supabase channels.
   */
  public async disconnectClient(): Promise<void> {
    this.isClientConnected = false;
    this.notifyClientStatus(false);

    if (this.audioAttachedElement) {
      try {
        this.audioAttachedElement.pause();
        this.audioAttachedElement.src = '';
      } catch {}
      this.audioAttachedElement = null;
    }

    if (this.clientRoom) {
      try {
        await this.clientRoom.disconnect();
      } catch {}
      this.clientRoom = null;
    }

    if (this.realtimeChannel) {
      try {
        const client = getSupabaseClient();
        if (client) {
          client.removeChannel(this.realtimeChannel);
        }
      } catch {}
      this.realtimeChannel = null;
    }
  }

  /**
   * Sends a remote control command from Mobile to Desktop Host.
   */
  public sendRemoteCommand(cmd: ConnectCommand): void {
    if (!this.realtimeChannel) return;

    this.realtimeChannel.send({
      type: 'broadcast',
      event: 'remote_cmd',
      payload: cmd,
    }).catch((err: any) => {
      console.warn('[Spytify Connect] Send remote command failed:', err);
    });
  }

  public sendCommand(cmd: ConnectCommand): void {
    this.sendRemoteCommand(cmd);
  }

  public async connectClient(
    userId: string,
    onState?: StateCallback,
    targetAudioElement?: HTMLAudioElement
  ): Promise<boolean> {
    return this.connectAsClient(userId, onState, targetAudioElement);
  }

  private initClientRealtime(userId: string) {
    const client = getSupabaseClient();
    if (!client) return;

    const channelName = `spytify_remote_${userId}`;
    this.realtimeChannel = client.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    this.realtimeChannel
      .on('broadcast', { event: 'state_update' }, ({ payload }: { payload: ConnectPlaybackState }) => {
        if (!payload) return;
        this.lastState = payload;
        this.onStateCallbacks.forEach(cb => cb(payload));
      })
      .on('presence', { event: 'sync' }, () => {
        const state = this.realtimeChannel.presenceState();
        const hasHost = Object.values(state).some((presences: any) =>
          Array.isArray(presences) && presences.some(p => p.role === 'host')
        );
        this.isHostOnline = hasHost;
        this.notifyHostStatus(hasHost);
      })
      .subscribe();
  }

  /**
   * Subscribes to host presence updates (to know if Desktop is online without connecting audio).
   */
  public monitorHostOnline(userId: string, onHostStatus: StatusCallback): () => void {
    this.onHostStatusCallbacks.add(onHostStatus);
    onHostStatus(this.isHostOnline);

    const client = getSupabaseClient();
    if (!client) return () => {};

    const channelName = `spytify_remote_${userId}`;
    const channel = client.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const hasHost = Object.values(state).some((presences: any) =>
          Array.isArray(presences) && presences.some(p => p.role === 'host')
        );
        this.isHostOnline = hasHost;
        this.notifyHostStatus(hasHost);
      })
      .subscribe();

    return () => {
      this.onHostStatusCallbacks.delete(onHostStatus);
      try {
        client.removeChannel(channel);
      } catch {}
    };
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
