/** OpenAPI 3.1 description of the hub's export API, served at /hub/v1/openapi.json for dashboard tools that import one. */
export function openapi(server: string) {
  const q = (name: string, description: string, schema: Record<string, unknown> = { type: 'string' }) => ({ name, in: 'query', required: false, description, schema });
  const common = [
    q('center', 'Only this centre id'),
    q('format', 'json (default) or csv', { type: 'string', enum: ['json', 'csv'] }),
    q('key', 'The export key, for tools that cannot send an Authorization header'),
  ];
  const table = (summary: string, extra: unknown[] = []) => ({
    get: {
      summary, parameters: [...common, ...extra], security: [{ bearer: [] }, { queryKey: [] }],
      responses: { 200: { description: 'JSON `{ data: [...], count }` or CSV with a header row' }, 401: { description: 'Missing or wrong export key' } },
    },
  });
  const since = q('since', 'ISO date-time: rows after this time', { type: 'string', format: 'date-time' });
  const until = q('until', 'ISO date-time: rows before this time', { type: 'string', format: 'date-time' });
  const limit = q('limit', 'Rows per page (max 10000, default 1000)', { type: 'integer' });
  return {
    openapi: '3.1.0',
    info: { title: 'VTC_LMS cloud hub — dashboard export API', version: '1.0.0',
      description: 'Read-only data from every training centre that syncs to this hub. Authenticate with the export key (HUB_EXPORT_KEY).' },
    servers: [{ url: server }],
    components: { securitySchemes: {
      bearer: { type: 'http', scheme: 'bearer', description: 'Authorization: Bearer <HUB_EXPORT_KEY>' },
      queryKey: { type: 'apiKey', in: 'query', name: 'key' },
    } },
    paths: {
      '/hub/v1/export/centers': table('Centres: last time each one synced, learner and record counts, writes waiting'),
      '/hub/v1/export/kpis': table('Headline numbers per centre over time (learners, active learners, V-Lab pass rate, floor average, safety alerts, OJT check-ins, risk bands)',
        [since, until, limit, q('latest', 'true = only the latest row per centre', { type: 'boolean' })]),
      '/hub/v1/export/trades': table('Per-trade numbers from each centre\'s latest upload'),
      '/hub/v1/export/learners': table('Learner roster with cohort, trade, early-warning band and last activity', [limit]),
      '/hub/v1/export/activity': table('Every learning record, one row per statement (V-Lab, floor rubric, OJT check-in, machine pre-check)', [since, until, limit]),
      '/hub/v1/xapi/statements': { get: { summary: 'xAPI 1.0.3 statement feed (statements + more)', parameters: [q('center', 'Only this centre id'), since, limit, q('key', 'The export key')],
        security: [{ bearer: [] }, { queryKey: [] }], responses: { 200: { description: '{ statements: [...], more: "<next page url or empty>" }' } } } },
    },
  };
}
