import { createIndexerClient } from './indexerClient';

test('listIntents builds the query string and unwraps {intents}', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ intents: [{ pda: 'x' }] }) });
  vi.stubGlobal('fetch', fetchMock);
  const client = createIndexerClient('https://idx.test');
  const rows = await client.listIntents({ status: 'active', maker: 'M', limit: 25 });
  const url = fetchMock.mock.calls[0][0] as string;
  expect(url).toContain('https://idx.test/intents?');
  expect(url).toContain('status=active');
  expect(url).toContain('maker=M');
  expect(url).toContain('limit=25');
  expect(rows).toEqual([{ pda: 'x' }]);
});

test('health returns false when the request throws', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
  const client = createIndexerClient('https://idx.test');
  expect(await client.health()).toBe(false);
});
