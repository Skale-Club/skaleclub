// Built production UI and real live routes; all records and sources are disposable.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import express, { type RequestHandler } from 'express';
import { chromium, firefox, webkit, type Browser, type BrowserType, type Page } from 'playwright';
import { registerLiveSharingRoutes } from '../server/routes/liveSharing.js';
import { LiveSharingService } from '../server/liveSharing/service.js';
import { MemoryLiveStore } from '../server/liveSharing/__tests__/memoryStore.js';
import { originCheck } from '../server/lib/originCheck.js';
import type { LiveSessionView, LiveSnapshot } from '../shared/liveSharing.js';

const engines: Record<string, BrowserType> = { chromium, firefox, webkit };
const branding = { companyName: 'Test Studio', logoAvatarFull: null, logoDark: null, logoMain: null, logoAvatarMark: null, logoIcon: null };
const deck: LiveSnapshot = {
  kind: 'presentation', title: 'Live proposal', branding,
  slides: [
    { layout: 'cover', heading: 'Live proposal', headingPt: 'Proposta ao vivo' },
    { layout: 'title-body', heading: 'Scope', headingPt: 'Escopo', body: 'Scope details. '.repeat(160), bodyPt: 'Detalhes do escopo. '.repeat(160) },
    { layout: 'closing', heading: 'Next steps', headingPt: 'Próximos passos' },
  ],
};
const estimate: LiveSnapshot = {
  kind: 'estimate', title: 'Confidential proposal', branding,
  estimate: {
    id: 1, slug: 'private-quote', clientName: 'Private Customer', companyName: null, contactName: null,
    note: null, createdAt: null, hasAccessCode: true,
    services: [{ type: 'custom', order: 0, title: 'Private package', description: 'Confidential service', price: '$1,234', features: ['Private feature'] }],
  },
};

function createHarness() {
  const store = new MemoryLiveStore();
  const service = new LiveSharingService(store, {
    secret: () => 'browser-live-test-secret-with-at-least-32-characters',
    loadSource: async (kind) => kind === 'presentation' ? { snapshot: deck } : { snapshot: estimate, accessCode: 'code-123' },
  });
  const app = express();
  app.use(express.json());
  app.use(originCheck);
  app.use((req, _res, next) => {
    // Only the presenter's browser context receives this test-only cookie.
    const owner = /(?:^|;\s*)test_admin=owner(?:;|$)/.test(req.headers.cookie ?? '');
    (req as unknown as { session: { userId?: string } }).session = owner ? { userId: 'owner' } : {};
    next();
  });
  const requireAdmin: RequestHandler = (req, res, next) => {
    if (!(req as unknown as { session: { userId?: string } }).session.userId) {
      res.status(401).json({ message: 'Authentication required' }); return;
    }
    next();
  };
  const streams = registerLiveSharingRoutes(app, { service, requireAdmin, enabled: () => true });
  app.get('/api/company-settings', (_req, res) => res.json({ ...branding, sectionsOrder: [] }));
  app.all(/^\/api\//, (_req, res) => res.json([]));
  const dist = path.resolve('dist/public');
  app.use(express.static(dist, { index: false }));
  app.get(/.*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  return { app, streams };
}

async function assertSlide(page: Page, heading: string) {
  await page.getByTestId('live-slide').getByRole('heading', { name: heading, exact: true }).waitFor();
}

for (const engine of (process.env.E2E_BROWSERS || 'chromium').split(',')) {
  test(`live sharing: explicit QR, two phones, late join, code gate, revoke and end (${engine})`, { timeout: 120_000 }, async () => {
    const harness = createHarness();
    const server = harness.app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    let browser: Browser | undefined;
    try {
      assert.ok(engines[engine], `Unknown browser engine: ${engine}`);
      browser = await engines[engine].launch({ headless: true });
      const errors: string[] = [];
      const tracking: string[] = [];
      function observe(page: Page) {
        page.setDefaultTimeout(12_000);
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('request', (request) => {
          if (/api\/(attribution|analytics|monitoring)|google-analytics|googletagmanager|facebook\.com/.test(request.url())) tracking.push(request.url());
        });
      }
      const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      await adminContext.addCookies([{ name: 'test_admin', value: 'owner', url: origin, httpOnly: true }]);
      // An abandoned login hint must not hijack a private live URL.
      await adminContext.addInitScript(() => sessionStorage.setItem('adminPostLoginRedirect', JSON.stringify({ ts: Date.now() })));
      const presenter = await adminContext.newPage(); observe(presenter);
      async function start(kind: 'presentation' | 'estimate') {
        const response = await adminContext.request.post(`${origin}/api/live-sessions`, { data: { kind, sourceId: kind === 'estimate' ? '1' : 'deck', language: 'en' } });
        assert.equal(response.status(), 201);
        const created = await response.json() as LiveSessionView & { controllerToken: string };
        await adminContext.addInitScript(({ id, token }) => sessionStorage.setItem(`live-controller:${id}`, token), { id: created.state.id, token: created.controllerToken });
        await presenter.goto(`${origin}/live/${created.state.id}/present`);
        await presenter.getByTestId('live-presenter').waitFor();
        assert.match(presenter.url(), /\/live\/.+\/present$/);
        assert.equal(await presenter.getByTestId('live-qr').count(), 0);
        assert.equal(await presenter.getByTestId('live-share-panel').count(), 0);
        await presenter.getByTestId('live-share').click();
        await presenter.getByTestId('live-qr').waitFor();
        const link = await presenter.getByTestId('live-clean-output').getAttribute('href');
        assert.ok(link?.startsWith(`${origin}/live/${created.state.id}#token=`));
        return { id: created.state.id, link: link! };
      }
      async function phone(width = 390) {
        const context = await browser!.newContext({ viewport: { width, height: 844 } });
        const page = await context.newPage(); observe(page);
        return { context, page };
      }

      const session = await start('presentation');
      const first = await phone(), second = await phone(375);
      await Promise.all([first.page.goto(session.link), second.page.goto(session.link)]);
      await Promise.all([assertSlide(first.page, 'Live proposal'), assertSlide(second.page, 'Live proposal')]);
      assert.equal(new URL(first.page.url()).hash, '');
      assert.equal(await first.page.getByTestId('live-next').count(), 0);
      assert.equal(await first.page.getByTestId('live-slide-jump').count(), 0);
      assert.equal(await first.page.getByTestId('live-language').count(), 0);
      assert.match(await first.page.locator('meta[name="robots"]').getAttribute('content') ?? '', /noindex/);
      await presenter.getByTestId('live-next').click();
      await Promise.all([assertSlide(first.page, 'Scope'), assertSlide(second.page, 'Scope')]);
      await first.page.getByTestId('live-slide').evaluate((element) => { element.scrollTop = 400; });
      assert.ok(await first.page.getByTestId('live-slide').evaluate((element) => element.scrollTop) > 0);
      await presenter.getByTestId('live-language').selectOption('pt-BR');
      await Promise.all([assertSlide(first.page, 'Escopo'), assertSlide(second.page, 'Escopo')]);
      const late = await phone(360);
      await late.page.goto(session.link);
      await assertSlide(late.page, 'Escopo');
      // Refresh reuses only the scoped HttpOnly cookie; no fragment or local secret.
      await late.page.reload(); await assertSlide(late.page, 'Escopo');
      await presenter.getByTestId('live-next').click();
      await Promise.all([assertSlide(first.page, 'Próximos passos'), assertSlide(second.page, 'Próximos passos'), assertSlide(late.page, 'Próximos passos')]);
      assert.equal(await first.page.getByTestId('live-slide').evaluate((element) => element.scrollTop), 0);
      assert.equal(await first.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await presenter.getByTestId('live-revoke').click();
      await Promise.all([first.page.getByTestId('live-terminal').waitFor(), second.page.getByTestId('live-terminal').waitFor(), late.page.getByTestId('live-terminal').waitFor()]);
      assert.equal(await first.page.getByTestId('live-slide').count(), 0);
      assert.equal(await presenter.getByTestId('live-presenter').isVisible(), true);
      await Promise.all([first.context.close(), second.context.close(), late.context.close()]);

      const quote = await start('estimate');
      await presenter.getByTestId('live-code-notice').waitFor();
      const client = await phone();
      await client.page.goto(quote.link);
      await client.page.getByTestId('live-access-code').waitFor();
      assert.equal(await client.page.getByTestId('live-slide').count(), 0);
      assert.ok(new URL(client.page.url()).hash.includes('token='));
      await client.page.getByTestId('live-access-code').fill('wrong-code');
      await client.page.getByTestId('live-join').click();
      await client.page.getByRole('alert').waitFor();
      assert.equal(await client.page.getByTestId('live-slide').count(), 0);
      await client.page.getByTestId('live-access-code').fill('code-123');
      await client.page.getByTestId('live-join').click();
      await assertSlide(client.page, 'Private Customer');
      assert.equal(new URL(client.page.url()).hash, '');
      const credentials = await client.context.cookies(`${origin}/api/live-sessions/${quote.id}/view`);
      assert.ok(credentials.some((cookie) => cookie.name === 'live_viewer' && cookie.httpOnly));
      const forbidden = await client.context.request.post(`${origin}/api/live-sessions/${quote.id}/takeover`, { data: {} });
      assert.equal(forbidden.status(), 401);
      presenter.once('dialog', (dialog) => dialog.accept());
      await presenter.getByTestId('live-end').click();
      await Promise.all([client.page.getByTestId('live-terminal').waitFor(), presenter.getByTestId('live-terminal').waitFor()]);
      assert.equal(await client.page.getByTestId('live-slide').count(), 0);
      assert.deepEqual(tracking, []);
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close();
      harness.streams.close();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
}
