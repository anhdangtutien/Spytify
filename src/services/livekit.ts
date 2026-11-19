import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  RemoteAudioTrack,
  RemoteVideoTrack,
  RemoteParticipant,
  LocalParticipant,
  Participant,
  VideoPresets,
} from 'livekit-client';
import { AccessToken } from 'livekit-server-sdk';

export interface LiveKitConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
}

// Support primary & backup LiveKit pools for seamless rotation
export let LIVEKIT_CONFIGS: LiveKitConfig[] = [
  {
    url: (import.meta.env.VITE_LIVEKIT_URL || 'wss://spytify-1auca4vy.livekit.cloud').trim(),
    apiKey: (import.meta.env.VITE_LIVEKIT_API_KEY || 'API4wdQsC4LxYnT').trim(),
    apiSecret: (import.meta.env.VITE_LIVEKIT_API_SECRET || 'JdDETGRD4Z35tCZ21UtPeCLaTzgLjkyn8u02ole8M9w').trim(),
  },
  ...(import.meta.env.VITE_LIVEKIT_BACKUP_URL
    ? [
        {
          url: import.meta.env.VITE_LIVEKIT_BACKUP_URL.trim(),
          apiKey: (import.meta.env.VITE_LIVEKIT_BACKUP_API_KEY || '').trim(),
          apiSecret: (import.meta.env.VITE_LIVEKIT_BACKUP_API_SECRET || '').trim(),
        },
      ]
    : [
        {
          url: 'wss://spytify-back-up-g0351wg5.livekit.cloud',
          apiKey: 'APIwJ7pnT3CnHHr',
          apiSecret: 'Ch8AZB63snYS9P23rvG97VNnBq8ZmuLwaaIm9vWrcOI',
        },
      ]),
];

export function updateDynamicLiveKitConfigs(newConfigs: LiveKitConfig[]) {
  if (Array.isArray(newConfigs) && newConfigs.length > 0) {
    LIVEKIT_CONFIGS = [...newConfigs];
    console.log('[LiveKit] Updated active SFU pool from Remote Config:', LIVEKIT_CONFIGS.length, 'nodes');
  }
}

export async function createLiveKitToken(
  roomName: string,
  participantId: string,
  participantName?: string,
  configIndex: number = 0
): Promise<{ token: string; serverUrl: string }> {
  const config = LIVEKIT_CONFIGS[configIndex] || LIVEKIT_CONFIGS[0];
  if (!config.apiKey || !config.apiSecret) {
    throw new Error('LiveKit API key or secret missing');
  }

  const at = new AccessToken(config.apiKey, config.apiSecret, {
    identity: participantId,
    name: participantName || participantId,
  });

  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  const token = await at.toJwt();
  return { token, serverUrl: config.url };
}

export type SpeakerChangeCallback = (speakingUserIds: string[]) => void;
export type RemoteTrackCallback = (track: RemoteTrack, participant: RemoteParticipant) => void;

export class LiveKitVoiceEngine {
  private room: Room | null = null;
  private currentRoomName: string | null = null;
  private remoteAudioElements: Map<string, HTMLAudioElement> = new Map();
  private userVolumes: Record<string, number> = {};
  private isDeafened: boolean = false;
  private isLocallyMuted: Record<string, boolean> = {};

  private onActiveSpeakersChanged?: SpeakerChangeCallback;
  private onTrackSubscribed?: RemoteTrackCallback;
  private onTrackUnsubscribed?: (track: RemoteTrack, participant: RemoteParticipant) => void;
  private onParticipantDisconnected?: (participant: RemoteParticipant) => void;

  constructor(callbacks?: {
    onActiveSpeakersChanged?: SpeakerChangeCallback;
    onTrackSubscribed?: RemoteTrackCallback;
    onTrackUnsubscribed?: (track: RemoteTrack, participant: RemoteParticipant) => void;
    onParticipantDisconnected?: (participant: RemoteParticipant) => void;
  }) {
    if (callbacks) {
      this.onActiveSpeakersChanged = callbacks.onActiveSpeakersChanged;
      this.onTrackSubscribed = callbacks.onTrackSubscribed;
      this.onTrackUnsubscribed = callbacks.onTrackUnsubscribed;
      this.onParticipantDisconnected = callbacks.onParticipantDisconnected;
    }
  }

  /**
   * Connect to room with automatic server pool rotation (Primary -> Backup)
   */
  async joinRoom(
    roomName: string,
    participantId: string,
    participantName?: string,
    options?: {
      micEnabled?: boolean;
      cameraEnabled?: boolean;
    }
  ): Promise<boolean> {
    await this.leaveRoom();

    for (let i = 0; i < LIVEKIT_CONFIGS.length; i++) {
      try {
        const { token, serverUrl } = await createLiveKitToken(roomName, participantId, participantName, i);
        console.log(`[LiveKit SFU] Connecting to ${serverUrl} (Pool #${i + 1})...`);

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          audioCaptureDefaults: {
            autoGainControl: true,
            echoCancellation: true,
            noiseSuppression: true,
          },
          videoCaptureDefaults: {
            resolution: VideoPresets.h720.resolution,
          },
        });

        this.setupRoomListeners(room);

        await room.connect(serverUrl, token);
        this.room = room;
        this.currentRoomName = roomName;

        if (options?.micEnabled ?? true) {
          await room.localParticipant.setMicrophoneEnabled(true).catch(err => {
            console.warn('[LiveKit SFU] Local mic init warning:', err);
          });
        }

        if (options?.cameraEnabled) {
          await room.localParticipant.setCameraEnabled(true).catch(err => {
            console.warn('[LiveKit SFU] Local camera init warning:', err);
          });
        }

        console.log(`[LiveKit SFU] Successfully joined room: ${roomName} via Pool #${i + 1}`);
        return true;
      } catch (err) {
        console.warn(`[LiveKit SFU] Failed connecting to Pool #${i + 1}:`, err);
        if (this.room) {
          await this.room.disconnect().catch(() => {});
          this.room = null;
        }
      }
    }

    console.error('[LiveKit SFU] All LiveKit server pools failed.');
    return false;
  }

  private setupRoomListeners(room: Room) {
    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication, participant: RemoteParticipant) => {
      console.log(`[LiveKit SFU] Remote track subscribed: ${track.kind} from ${participant.identity}`);

      if (track.kind === Track.Kind.Audio) {
        const audioTrack = track as RemoteAudioTrack;
        const audioElement = audioTrack.attach();
        audioElement.autoplay = true;

        this.remoteAudioElements.set(participant.identity, audioElement);
        this.applyVolumeToElement(participant.identity, audioElement);
      }

      this.onTrackSubscribed?.(track, participant);
    });

    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, publication, participant: RemoteParticipant) => {
      console.log(`[LiveKit SFU] Remote track unsubscribed: ${track.kind} from ${participant.identity}`);
      track.detach();

      if (track.kind === Track.Kind.Audio) {
        this.remoteAudioElements.delete(participant.identity);
      }

      this.onTrackUnsubscribed?.(track, participant);
    });

    room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
      const activeIds = speakers.map(s => s.identity);
      this.onActiveSpeakersChanged?.(activeIds);
    });

    room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      this.remoteAudioElements.delete(participant.identity);
      this.onParticipantDisconnected?.(participant);
    });

    room.on(RoomEvent.Disconnected, () => {
      console.log('[LiveKit SFU] Room disconnected');
      this.cleanUpAudioElements();
      this.room = null;
      this.currentRoomName = null;
    });
  }

  setMicrophoneEnabled(enabled: boolean): Promise<void> {
    if (!this.room) return Promise.resolve();
    return this.room.localParticipant.setMicrophoneEnabled(enabled).then(() => {});
  }

  setCameraEnabled(enabled: boolean): Promise<void> {
    if (!this.room) return Promise.resolve();
    return this.room.localParticipant.setCameraEnabled(enabled).then(() => {});
  }

  setScreenShareEnabled(enabled: boolean): Promise<void> {
    if (!this.room) return Promise.resolve();
    return this.room.localParticipant.setScreenShareEnabled(enabled).then(() => {});
  }

  setUserVolume(userId: string, volumeScale: number) {
    this.userVolumes[userId] = Math.max(0, Math.min(2, volumeScale));
    const el = this.remoteAudioElements.get(userId);
    if (el) this.applyVolumeToElement(userId, el);
  }

  setDeafened(deafened: boolean) {
    this.isDeafened = deafened;
    this.remoteAudioElements.forEach((el, userId) => {
      this.applyVolumeToElement(userId, el);
    });
  }

  setLocallyMuted(userId: string, muted: boolean) {
    this.isLocallyMuted[userId] = muted;
    const el = this.remoteAudioElements.get(userId);
    if (el) this.applyVolumeToElement(userId, el);
  }

  private applyVolumeToElement(userId: string, el: HTMLAudioElement) {
    if (this.isDeafened || this.isLocallyMuted[userId]) {
      el.muted = true;
      el.volume = 0;
    } else {
      el.muted = false;
      const vol = this.userVolumes[userId] ?? 1.0;
      el.volume = Math.max(0, Math.min(1, vol));
    }
  }

  private cleanUpAudioElements() {
    this.remoteAudioElements.forEach(el => {
      el.pause();
      el.srcObject = null;
      el.remove();
    });
    this.remoteAudioElements.clear();
  }

  async leaveRoom() {
    if (this.room) {
      try {
        await this.room.disconnect();
      } catch {}
      this.cleanUpAudioElements();
      this.room = null;
      this.currentRoomName = null;
    }
  }

  isConnected(): boolean {
    return this.room !== null && this.room.state === 'connected';
  }

  getRoomName(): string | null {
    return this.currentRoomName;
  }
}

// Global singleton instance for easy cross-component access
export const livekitVoice = new LiveKitVoiceEngine();
