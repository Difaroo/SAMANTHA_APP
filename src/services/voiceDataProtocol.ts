export type VoiceSpeaker = 'you' | 'samantha' | 'guest' | 'unknown' | 'ambient';

export type VoiceDataEvent =
  | { kind: 'ready'; generation: number }
  | { kind: 'warming'; generation: number }
  | { kind: 'error'; code: string; message: string }
  | { kind: 'enrollment'; status: 'enrolled' | 'rejected'; speakerId: string | null }
  | { kind: 'settings'; speed: number; overrideActive: boolean }
  | {
      kind: 'subtitle';
      text: string;
      speaker: VoiceSpeaker;
      deliveryId: string | null;
      speakerId: string | null;
    };

const DELIVERY_ID = /^[0-9a-f]{12}$/;
const SPEAKER_ID = /^S\d+$/;
const ERROR_CODE = /^[a-z0-9_]{1,64}$/;

function decodeJson(payload: Uint8Array | string): Record<string, unknown> | null {
  try {
    const raw = typeof payload === 'string' ? payload : new TextDecoder().decode(payload);
    const value = JSON.parse(raw) as unknown;
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function generationOf(data: Record<string, unknown>): number | null {
  return Number.isInteger(data.generation) && Number(data.generation) >= 0
    ? Number(data.generation)
    : null;
}

export function decodeVoiceDataEvent(
  topic: string | undefined,
  payload: Uint8Array | string,
): VoiceDataEvent | null {
  const data = decodeJson(payload);
  if (!data) return null;

  if (topic === 'ready_ack') {
    const generation = generationOf(data);
    if (generation === null) return null;
    const fullyReady =
      data.status === 'ready' &&
      data.sessionReady === true &&
      data.clientReady === true &&
      data.audioReady === true;
    if (fullyReady) return { kind: 'ready', generation };
    if (data.status === 'warming') return { kind: 'warming', generation };
    return null;
  }

  if (topic === 'voice_error') {
    const code = typeof data.code === 'string' && ERROR_CODE.test(data.code)
      ? data.code
      : 'voice_turn_failed';
    return { kind: 'error', code, message: `Voice turn failed (${code}). Please try again.` };
  }

  if (topic === 'speaker_enrollment') {
    const status = data.status === 'enrolled'
      ? 'enrolled'
      : data.status === 'rejected'
        ? 'rejected'
        : null;
    if (!status) return null;
    const speakerId = typeof data.speakerId === 'string' && SPEAKER_ID.test(data.speakerId)
      ? data.speakerId
      : null;
    return { kind: 'enrollment', status, speakerId };
  }

  if (topic === 'voice_settings') {
    const speed = typeof data.speed === 'number' && Number.isFinite(data.speed)
      && data.speed >= 0.5 && data.speed <= 2
      ? data.speed
      : null;
    if (speed === null || typeof data.overrideActive !== 'boolean') return null;
    return { kind: 'settings', speed, overrideActive: data.overrideActive };
  }

  if (topic !== 'raw_subtitle' || typeof data.text !== 'string') return null;
  const rawText = data.text.trim().slice(0, 4_000);
  if (!rawText) return null;

  const deliveryId = typeof data.deliveryId === 'string' && DELIVERY_ID.test(data.deliveryId)
    ? data.deliveryId
    : null;
  const speakerId = typeof data.speakerId === 'string' && SPEAKER_ID.test(data.speakerId)
    ? data.speakerId
    : null;
  const role = data.speakerRole;
  const speaker: VoiceSpeaker =
    role === 'david' ? 'you'
      : role === 'guest' ? 'guest'
        : role === 'ambient' ? 'ambient'
          : role === 'unknown' ? 'unknown'
            : role === 'samantha' ? 'samantha'
              : 'unknown';
  const text = speaker === 'samantha' ? rawText : rawText.replace(/^[^:]+:\s*/, '');

  return { kind: 'subtitle', text, speaker, deliveryId, speakerId };
}
