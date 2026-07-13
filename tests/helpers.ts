import type { Page, Route } from '@playwright/test';

export const prismSeed = [
  {
    id: 'samantha-audio-core',
    name: 'Samantha Audio Core',
    type: 'Project',
    status: 'Active',
    abstract: 'Voice bridge and mobile audio work.',
    children: [
      {
        id: 'task-webrtc-bridge',
        text: 'Implement WebRTC Bridge',
        abstract: 'Connect the mobile app to the production LiveKit voice bridge.',
        prompt: '- Join the LiveKit room\n- Show transcripts\n- Keep the voice bridge replaceable',
        status: 'pending',
        done: false,
        impact: 9,
        effort: 6,
        created: '2026-06-30T09:00:00.000Z',
        nextRank: '000000001000',
        inGlobalBacklog: true,
      },
      {
        id: 'task-android-audio',
        text: 'Verify Android Audio Route',
        abstract: 'Confirm Bluetooth, headset, and speaker routes behave correctly.',
        prompt: '- Prefer Bluetooth\n- Avoid earpiece\n- Survive phone calls',
        status: 'pending',
        done: false,
        impact: 8,
        effort: 5,
        created: '2026-06-30T09:10:00.000Z',
        nextRank: null,
        inGlobalBacklog: false,
      },
    ],
  },
  {
    id: 'prism-dispatch',
    name: 'PRISM Dispatch',
    type: 'Project',
    status: 'Active',
    abstract: 'Dispatch UX and contract testing.',
    children: [
      {
        id: 'task-contract-tests',
        text: 'Write Contract Tests',
        abstract: 'Test the user outcomes instead of component trivia.',
        prompt: '- Offline edits\n- Sync recovery\n- Voice PTT',
        status: 'pending',
        done: false,
        impact: 7,
        effort: 4,
        created: '2026-06-30T09:20:00.000Z',
        nextRank: '000000002000',
        inGlobalBacklog: true,
      },
    ],
  },
];

const jsonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function fulfillJson(route: Route, body: unknown, status = 200) {
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({ status: 200, headers: jsonHeaders });
    return;
  }

  await route.fulfill({
    status,
    headers: jsonHeaders,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

export async function mockPrismSeed(page: Page, seed = prismSeed) {
  await page.route('**/api/v1/sync', async (route) => {
    const request = route.request().postDataJSON() as { mutations?: Array<{ id: string; entityType: string; entityId: string }> };
    await fulfillJson(route, {
      schemaVersion: 1,
      revision: 1,
      cursor: 1,
      streams: seed,
      acknowledgements: (request.mutations || []).map((mutation) => ({
        ...mutation,
        status: 'applied',
        version: 1,
      })),
      conflicts: [],
      hasMore: false,
    });
  });
}

export async function mockVoiceToken(page: Page) {
  await page.route('**/api/voice/token**', async (route) => fulfillJson(route, {
    token: 'contract-test-token',
    serverUrl: 'mock://voice-bridge',
    room: 'samantha-room',
    identity: 'david',
  }));
}
