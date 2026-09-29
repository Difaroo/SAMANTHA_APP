import { expect, test } from '@playwright/test';
import { RoomLease } from '../src/services/roomLease';
import { decodeVoiceDataEvent } from '../src/services/voiceDataProtocol';

const encode = (value: unknown) => JSON.stringify(value);

test.describe('Samantha Voice 2.6.1 client contracts', () => {
  test('connection is ready only after the complete generation-scoped contract', () => {
    const incomplete = [
      { status: 'ready', sessionReady: true, clientReady: true, audioReady: true },
      { status: 'ready', sessionReady: true, clientReady: true, audioReady: false, generation: 3 },
      { status: 'ready', sessionReady: true, clientReady: false, audioReady: true, generation: 3 },
      { status: 'ready', sessionReady: false, clientReady: true, audioReady: true, generation: 3 },
      { status: 'ready', sessionReady: true, clientReady: true, audioReady: true, generation: -1 },
    ];

    for (const payload of incomplete) {
      expect(decodeVoiceDataEvent('ready_ack', encode(payload))?.kind).not.toBe('ready');
    }
    expect(decodeVoiceDataEvent('ready_ack', encode({
      status: 'ready',
      sessionReady: true,
      clientReady: true,
      audioReady: true,
      generation: 3,
    }))).toEqual({ kind: 'ready', generation: 3 });
  });

  test('warming is explicit and malformed transport data fails closed', () => {
    expect(decodeVoiceDataEvent('ready_ack', encode({
      status: 'warming',
      generation: 9,
    }))).toEqual({ kind: 'warming', generation: 9 });
    expect(decodeVoiceDataEvent('ready_ack', '{')).toBeNull();
    expect(decodeVoiceDataEvent('raw_subtitle', '[]')).toBeNull();
    expect(decodeVoiceDataEvent('voice_error', encode({ code: '<script>' }))).toEqual({
      kind: 'error',
      code: 'voice_turn_failed',
      message: 'Voice turn failed (voice_turn_failed). Please try again.',
    });
  });

  test('speaker attribution, correction, and delivery identifiers are validated', () => {
    expect(decodeVoiceDataEvent('raw_subtitle', encode({
      text: 'Unknown: hello',
      speakerRole: 'unknown',
      speakerId: 'S1',
    }))).toMatchObject({ kind: 'subtitle', speaker: 'unknown', speakerId: 'S1', text: 'hello' });

    expect(decodeVoiceDataEvent('raw_subtitle', encode({
      text: 'Samantha: hello',
      speakerRole: 'samantha',
      deliveryId: 'abc123def456',
    }))).toMatchObject({ kind: 'subtitle', speaker: 'samantha', deliveryId: 'abc123def456' });

    expect(decodeVoiceDataEvent('speaker_enrollment', encode({
      status: 'enrolled',
      speakerId: 'S1',
    }))).toEqual({ kind: 'enrollment', status: 'enrolled', speakerId: 'S1' });

    expect(decodeVoiceDataEvent('speaker_enrollment', encode({
      status: 'enrolled',
      speakerId: '../../david',
    }))).toEqual({ kind: 'enrollment', status: 'enrolled', speakerId: null });
  });

  test('voice speed acknowledgements are bounded and explicit', () => {
    expect(decodeVoiceDataEvent('voice_settings', encode({
      speed: 0.75,
      overrideActive: true,
    }))).toEqual({ kind: 'settings', speed: 0.75, overrideActive: true });

    expect(decodeVoiceDataEvent('voice_settings', encode({
      speed: 2.1,
      overrideActive: true,
    }))).toBeNull();
    expect(decodeVoiceDataEvent('voice_settings', encode({
      speed: 0.9,
      overrideActive: 'yes',
    }))).toBeNull();
  });

  test('subtitle input is bounded and transport roles override claimed labels', () => {
    const event = decodeVoiceDataEvent('raw_subtitle', encode({
      text: `Claimed label: ${'x'.repeat(5_000)}`,
      speakerRole: 'guest',
      deliveryId: 'not-a-delivery-id',
    }));

    expect(event).toMatchObject({
      kind: 'subtitle',
      speaker: 'guest',
      deliveryId: null,
      text: expect.stringMatching(/^x+$/),
    });
    expect(event?.kind === 'subtitle' ? event.text.length : 0).toBeLessThanOrEqual(4_000);
  });

  test('stale room callbacks cannot release a newer connection', () => {
    const lease = new RoomLease<object>();
    const firstRoom = {};
    const secondRoom = {};

    const firstGeneration = lease.begin();
    expect(lease.attach(firstGeneration, firstRoom)).toBe(true);
    expect(lease.release(firstRoom)).toBe(true);

    const secondGeneration = lease.begin();
    expect(lease.attach(secondGeneration, secondRoom)).toBe(true);
    expect(lease.release(firstRoom)).toBe(false);
    expect(lease.cancel(firstGeneration)).toBe(false);
    expect(lease.current()).toBe(secondRoom);
  });

  test('disconnect cancels a credential request before a room exists', () => {
    const lease = new RoomLease<object>();
    const generation = lease.begin();
    expect(lease.cancel()).toBe(true);
    expect(lease.isCurrentGeneration(generation)).toBe(false);
    expect(lease.hasActiveCycle()).toBe(false);
  });
});
