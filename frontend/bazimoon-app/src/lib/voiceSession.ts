import AgoraRTC, { type IAgoraRTCClient, type IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";

/**
 * Thin wrapper around the Agora Web SDK for a single voice channel at a time (Bazimoon only ever
 * needs one active channel per player — main room or mafia room, never both simultaneously).
 */
export class VoiceSession {
  private client: IAgoraRTCClient | null = null;
  private micTrack: IMicrophoneAudioTrack | null = null;
  private transition: Promise<void> = Promise.resolve();
  private locallyMuted = new Set<number>();

  get isConnected(): boolean {
    return this.client !== null;
  }

  async join(appId: string, channelName: string, token: string, uid: number, canPublish: boolean): Promise<void> {
    return this.enqueue(async () => {
      await this.leaveNow();

      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      await client.join(appId, channelName, token, uid);
      this.client = client;

      client.on("user-published", async (user, mediaType) => {
        if (mediaType !== "audio") return;
        await client.subscribe(user, mediaType);
        if (this.locallyMuted.has(Number(user.uid))) user.audioTrack?.setVolume(0);
        user.audioTrack?.play();
      });

      if (canPublish) {
        this.micTrack = await AgoraRTC.createMicrophoneAudioTrack();
        await client.publish([this.micTrack]);
      }
    });
  }

  async setMuted(muted: boolean): Promise<void> {
    await this.micTrack?.setEnabled(!muted);
  }

  setRemoteMuted(uid: number, muted: boolean): void {
    if (muted) this.locallyMuted.add(uid);
    else this.locallyMuted.delete(uid);
    const track = this.client?.remoteUsers.find((user) => Number(user.uid) === uid)?.audioTrack;
    track?.setVolume(muted ? 0 : 100);
  }

  /** Loudest live voice right now, 0 to 1: your own mic while you publish, or whoever you can hear. */
  getLevel(): number {
    let level = 0;
    try {
      if (this.micTrack?.enabled) level = this.micTrack.getVolumeLevel();
      for (const user of this.client?.remoteUsers ?? []) {
        if (this.locallyMuted.has(Number(user.uid))) continue;
        level = Math.max(level, user.audioTrack?.getVolumeLevel() ?? 0);
      }
    } catch {
      return 0;
    }
    return level;
  }

  async leave(): Promise<void> {
    return this.enqueue(() => this.leaveNow());
  }

  private async leaveNow(): Promise<void> {
    this.micTrack?.close();
    this.micTrack = null;
    await this.client?.leave();
    this.client = null;
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const next = this.transition.catch(() => undefined).then(operation);
    this.transition = next;
    return next;
  }
}
