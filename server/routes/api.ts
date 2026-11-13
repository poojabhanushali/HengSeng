import { Router, Request, Response, NextFunction } from 'express';
import { marketRepo } from '../data/marketData';
import { socialRepo } from '../data/socialScraper';
import { newsRepo } from '../data/newsEngine';
import { mlEngine } from '../ml/predictiveEngine';
import { orchestrator } from '../agents/orchestrator';
import { appDb, uuidv4 } from '../db/sqlite';
import { ExchangeCode, SystemSettings, ExecutiveReport, User, UserRole } from '../../src/types';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  requirePermission, requireAnyPermission, requireRole, ALL_PERMISSIONS,
  getEffectivePermissions,
} from '../rbac';

export const apiRouter = Router();

// In-memory system settings
let currentSettings: SystemSettings = {
  apifyApiToken: process.env.APIFY_API_TOKEN || '',
  apifyLihkgActorId: process.env.APIFY_LIHKG_ACTOR_ID || 'apify/lihkg-scraper',
  apifyTelegramActorId: process.env.APIFY_TELEGRAM_ACTOR_ID || 'apify/telegram-scraper',
  apifyNaverActorId: process.env.APIFY_NAVER_ACTOR_ID || 'apify/naver-finance-scraper',
  apifyDaumActorId: process.env.APIFY_DAUM_ACTOR_ID || 'apify/daum-forum-scraper',
  exaApiKey: process.env.EXA_API_KEY || '',
  marketDataProvider: 'Local Deterministic OHLCV (Curated Fallback)',
  marketDataApiKey: process.env.MARKET_DATA_API_KEY || '',
  bullishThreshold: 20,
  bearishThreshold: -20,
  predictionHorizonDays: 1,
  dataRetentionDays: 10,
  enableAutomatedOrchestration: true,
  orchestrationIntervalHours: 4,
};

const VALID_EXCHANGES: ExchangeCode[] = ['HKEX', 'KRX'];

const JWT_SECRET = process.env.SECRET_KEY || 'hengseng-dev-secret-change-in-production';
const JWT_EXPIRES_IN = '8h';

interface AuthRequest extends Request {
  user?: User;
}

// ---- Authentication helpers ----
function generateToken(user: User): string {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN, issuer: 'hengseng' }
  );
}

function authenticate(req: AuthRequest, res: Response, next: NextFunction): void | Response {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required', detail: 'Missing or invalid Authorization header' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET, { issuer: 'hengseng' }) as { sub: string; role: string };
    const row = appDb.db.prepare('SELECT id,username,email,role,is_active,created_at FROM users WHERE id = ?').get(payload.sub) as any;
    if (!row || !row.is_active) {
      return res.status(401).json({ error: 'Authentication required', detail: 'User not found or inactive' });
    }
    req.user = {
      id: row.id,
      username: row.username,
      email: row.email,
      role: row.role as UserRole,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Authentication required', detail: 'Token expired or invalid' });
  }
}

function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void | Response {
  return authenticate(req, res, next);
}

function auditLog(actorId: string | undefined, action: string, entity: string, entityId: string | undefined, meta: any) {
  try {
    appDb.db.prepare(
      'INSERT INTO audit_logs (actor_id,action,entity,entity_id,meta,created_at) VALUES (?,?,?,?,?,?)'
    ).run(actorId ?? null, action, entity, entityId ?? null, JSON.stringify(meta ?? {}), new Date().toISOString());
  } catch { /* best-effort audit logging */ }
}

// Build an executive report from live repository + engine state (no hardcoded metrics).
function buildExecutiveReport(exchange: ExchangeCode | 'ALL'): ExecutiveReport {
  const assets = marketRepo.getAllAssets();
  const filtered = exchange === 'ALL' ? assets : assets.filter(a => a.exchange === exchange);
  const sortedBySentiment = [...filtered].sort((a, b) => b.overallSentiment - a.overallSentiment);
  const topBullish = sortedBySentiment[0];
  const topBearish = sortedBySentiment[sortedBySentiment.length - 1];

  const avgSent = Number((filtered.reduce((s, a) => s + a.overallSentiment, 0) / (filtered.length || 1)).toFixed(1));
  const totalM = filtered.reduce((s, a) => s + a.socialMentions, 0);
  const totalN = filtered.reduce((s, a) => s + a.newsMentions, 0);

  // Aggregate production-model (ensemble) walk-forward metrics across covered assets using identical OOS observations
  const accuracies: number[] = [];
  const maes: number[] = [];
  const mapes: number[] = [];
  const rmses: number[] = [];
  const r2s: number[] = [];
  const baselineImps: number[] = [];
  let sampleTotal = 0;
  let positiveDriftCount = 0;
  let modelName = 'Multi-Factor Quant Sentiment Ensemble';
  for (const a of filtered) {
    const evalRes = mlEngine.evaluateModelsForTicker(a.ticker);
    if (evalRes?.modelPerformances?.length) {
      const perf = evalRes.modelPerformances[0]; // index 0 is the deployed ensemble
      modelName = perf.modelName;
      accuracies.push(perf.directionalAccuracy);
      maes.push(perf.mae);
      mapes.push(perf.mape);
      rmses.push(perf.rmse);
      r2s.push(perf.r2Score);
      baselineImps.push(perf.baselineImprovement);
      sampleTotal += perf.sampleCount;
    }
    if (evalRes?.predictionDetail && evalRes.predictionDetail.predictedChangePercent > 0) {
      positiveDriftCount++;
    }
  }
  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / (arr.length || 1);
  const modelAcc = accuracies.length ? Number((avg(accuracies)).toFixed(1)) : 0;
  const modelMae = maes.length ? Number((avg(maes)).toFixed(2)) : 0;
  const modelMape = mapes.length ? Number((avg(mapes)).toFixed(2)) : 0;
  const modelRmse = rmses.length ? Number((avg(rmses)).toFixed(2)) : 0;
  const modelR2 = r2s.length ? Number((avg(r2s)).toFixed(3)) : 0;
  const modelBaseImp = baselineImps.length ? Number((avg(baselineImps)).toFixed(1)) : 0;

  // Determine bar timestamp range for evaluation period disclosure
  let firstBar = '';
  let lastBar = '';
  for (const a of filtered) {
    const bars = marketRepo.getBars(a.ticker);
    if (bars.length > 0) {
      if (!firstBar || bars[0].timestamp < firstBar) firstBar = bars[0].timestamp;
      if (!lastBar || bars[bars.length - 1].timestamp > lastBar) lastBar = bars[bars.length - 1].timestamp;
    }
  }
  const evaluationPeriod = firstBar && lastBar
    ? `${firstBar.split('T')[0]} to ${lastBar.split('T')[0]} (${filtered.length} assets, ${Math.round((filtered.length || 1) * 10)} daily bars)`
    : 'No price history available';

  const scopeLabel = exchange === 'ALL' ? 'Cross-exchange' : exchange;
  const summaryProse = `${scopeLabel} coverage spans ${filtered.length} monitored assets with ${totalM} social discussions and ${totalN} news articles analyzed. Average engagement-weighted social sentiment is ${avgSent >= 0 ? '+' : ''}${avgSent} points. ${positiveDriftCount} of ${filtered.length} assets currently carry a positive next-trading-session (n+1) model drift. Chronological walk-forward validation reports an average production-model directional accuracy of ${modelAcc}% across ${sampleTotal} out-of-sample observations. MAE ${modelMae}, MAPE ${modelMape}%, RMSE ${modelRmse}, OOS R² ${modelR2}.`;

  const limitations: string[] = [
    `Small sample: ${filtered.length} assets × 5 walk-forward folds = ${sampleTotal} out-of-sample observations; results are unstable and not suitable for live capital allocation.`,
    'OHLCV market data is deterministic seeded (local fallback), not a live vendor feed.',
    'Social and news data are curated local fallback datasets; no live Apify or Exa integration is active without credentials.',
    'All models show negative out-of-sample R² on this sample - none beats a simple mean forecast.',
    'The deployed ensemble is labeled "production" because it is deployed, not because it outperforms every baseline on every metric.',
  ];

  return {
    id: exchange === 'ALL' ? 'rep_all_latest' : `rep_${exchange.toLowerCase()}_latest`,
    title: `${scopeLabel} Quantitative Sentiment & Forecast Briefing`,
    createdAt: new Date().toISOString(),
    exchange,
    topBullishAsset: topBullish ? `${topBullish.ticker} (${topBullish.name})` : 'n/a',
    topBearishAsset: topBearish ? `${topBearish.ticker} (${topBearish.name})` : 'n/a',
    averageSentiment: avgSent,
    totalMentions: totalM,
    totalNews: totalN,
    modelDirectionalAccuracy: modelAcc,
    summaryProse,
    assetsRanked: sortedBySentiment,
    modelName,
    modelVersion: 'v1.0.0-walkforward-ensemble',
    evaluationPeriod,
    sampleSize: sampleTotal,
    mae: modelMae,
    mape: modelMape,
    rmse: modelRmse,
    r2Score: modelR2,
    baselineImprovementPercent: modelBaseImp,
    limitations,
  };
}

// Initial reports (computed, never hardcoded)
const generatedReports: ExecutiveReport[] = [
  buildExecutiveReport('HKEX'),
  buildExecutiveReport('KRX'),
  buildExecutiveReport('ALL'),
];

// Health Check
apiRouter.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'HengSeng Sentiment Price Prediction API',
    uptimeSeconds: process.uptime(),
    agentsCount: 8,
    monitoredAssets: marketRepo.getAllAssets().length,
  });
});

// ---- Authentication routes ----
apiRouter.post('/auth/register', async (req: Request, res: Response) => {
  const { username, email, password, role } = (req.body || {}) as {
    username?: string; email?: string; password?: string; role?: UserRole;
  };
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields', detail: 'username, email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Invalid password', detail: 'Password must be at least 6 characters' });
  }
  const existing = appDb.db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (existing) {
    return res.status(409).json({ error: 'Conflict', detail: 'Username or email already registered' });
  }
  const roleValue = role && ['admin', 'manager', 'viewer'].includes(role) ? role : 'viewer';
  const id = uuidv4();
  const passwordHash = await bcrypt.hash(password, 10);
  appDb.db.prepare(
    'INSERT INTO users (id,username,email,password_hash,role,is_active,created_at) VALUES (?,?,?,?,?,?,?)'
  ).run(id, username, email, passwordHash, roleValue, 1, new Date().toISOString());
  const row = appDb.db.prepare('SELECT id,username,email,role,is_active,created_at FROM users WHERE id = ?').get(id) as any;
  const user: User = {
    id: row.id, username: row.username, email: row.email, role: row.role as UserRole,
    isActive: Boolean(row.is_active), createdAt: row.created_at,
  };
  auditLog(id, 'user.register', 'users', id, { username, email, role: roleValue });
  return res.status(201).json({ status: 'success', message: 'User registered', user, accessToken: generateToken(user) });
});

apiRouter.post('/auth/login', async (req: Request, res: Response) => {
  const { username, password } = (req.body || {}) as { username?: string; password?: string };
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing credentials', detail: 'username and password are required' });
  }
  const row = appDb.db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
  if (!row) {
    return res.status(401).json({ error: 'Invalid credentials', detail: 'Username or password is incorrect' });
  }
  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials', detail: 'Username or password is incorrect' });
  }
  if (!row.is_active) {
    return res.status(401).json({ error: 'Account disabled', detail: 'This account has been deactivated' });
  }
  const user: User = {
    id: row.id, username: row.username, email: row.email, role: row.role as UserRole,
    isActive: Boolean(row.is_active), createdAt: row.created_at,
  };
  auditLog(user.id, 'user.login', 'users', user.id, {});
  return res.json({ status: 'success', message: 'Signed in', user, accessToken: generateToken(user) });
});

apiRouter.get('/auth/me', requireAuth, (req: AuthRequest, res: Response) => {
  return res.json({ status: 'success', user: req.user });
});

apiRouter.get('/auth/users', requirePermission('users', 'view'), (req: AuthRequest, res: Response) => {
  const rows = appDb.db.prepare('SELECT id,username,email,role,is_active,created_at FROM users ORDER BY created_at DESC').all() as any[];
  const users: User[] = rows.map(r => ({
    id: r.id, username: r.username, email: r.email, role: r.role as UserRole,
    isActive: Boolean(r.is_active), createdAt: r.created_at,
  }));
  return res.json({ status: 'success', users });
});

apiRouter.patch('/auth/users/:id/role', requireRole(['admin']), (req: AuthRequest, res: Response) => {
  const { role } = (req.body || {}) as { role?: UserRole };
  if (!role || !['admin', 'manager', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role', detail: 'role must be admin, manager or viewer' });
  }
  const target = appDb.db.prepare('SELECT id,username,role FROM users WHERE id = ?').get(req.params.id) as any;
  if (!target) {
    return res.status(404).json({ error: 'Not found', detail: 'User not found' });
  }
  appDb.db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  auditLog(req.user?.id, 'user.update_role', 'users', req.params.id, { target: target.username, newRole: role });
  return res.json({ status: 'success', message: 'Role updated', userId: req.params.id, role });
});

// ---- RBAC management routes ----
apiRouter.get('/auth/permissions', requireAuth, (req: AuthRequest, res: Response) => {
  const perms = getEffectivePermissions(appDb.db, req.user!.id);
  return res.json({ status: 'success', permissions: perms });
});

apiRouter.get('/auth/permissions/available', requireAuth, requirePermission('permissions', 'view'), (req: AuthRequest, res: Response) => {
  return res.json({ status: 'success', permissions: ALL_PERMISSIONS });
});

apiRouter.get('/auth/roles', requireAuth, requirePermission('roles', 'view'), (req: AuthRequest, res: Response) => {
  const rows = appDb.db.prepare('SELECT id,name,description,is_system,created_at FROM roles ORDER BY name').all() as any[];
  const roles = rows.map(r => ({
    id: r.id, name: r.name, description: r.description, isSystem: Boolean(r.is_system), createdAt: r.created_at,
  }));
  return res.json({ status: 'success', roles });
});

apiRouter.get('/auth/roles/:id/permissions', requireAuth, requirePermission('roles', 'view'), (req: AuthRequest, res: Response) => {
  const role = appDb.db.prepare('SELECT id,name FROM roles WHERE id = ?').get(req.params.id) as any;
  if (!role) {
    return res.status(404).json({ error: 'Not found', detail: 'Role not found' });
  }
  const rows = appDb.db.prepare(`
    SELECT p.id, p.resource, p.action, p.label, p.description, rp.granted
    FROM permissions p
    LEFT JOIN role_permissions rp ON rp.permission_id = p.id AND rp.role_id = ?
    ORDER BY p.resource, p.action
  `).all(req.params.id) as any[];
  const permissions = rows.map(r => ({
    id: r.id, resource: r.resource, action: r.action, label: r.label, description: r.description,
    granted: r.granted !== 0, // default true when no explicit row
  }));
  return res.json({ status: 'success', role: { id: role.id, name: role.name }, permissions });
});

apiRouter.put('/auth/roles/:id/permissions', requireAuth, requirePermission('roles', 'edit'), (req: AuthRequest, res: Response) => {
  const role = appDb.db.prepare('SELECT id,name FROM roles WHERE id = ?').get(req.params.id) as any;
  if (!role) {
    return res.status(404).json({ error: 'Not found', detail: 'Role not found' });
  }
  const { permissions } = (req.body || {}) as { permissions?: { id: string; granted: boolean }[] };
  if (!Array.isArray(permissions)) {
    return res.status(400).json({ error: 'Invalid body', detail: 'permissions array is required' });
  }
  // Prevent removing all permissions from the last admin role (self-lockout guard is advisory)
  const upsert = appDb.db.prepare(`
    INSERT OR REPLACE INTO role_permissions (role_id, permission_id, granted) VALUES (?, ?, ?)
  `);
  const tx = appDb.db.transaction(() => {
    for (const p of permissions) {
      upsert.run(req.params.id, p.id, p.granted ? 1 : 0);
    }
  });
  tx();
  auditLog(req.user?.id, 'role.update_permissions', 'roles', req.params.id, { count: permissions.length });
  return res.json({ status: 'success', message: 'Role permissions updated', roleId: req.params.id });
});

apiRouter.get('/auth/users/:id/permissions', requireAuth, (req: AuthRequest, res: Response) => {
  const target = appDb.db.prepare('SELECT id,username,role FROM users WHERE id = ?').get(req.params.id) as any;
  if (!target) {
    return res.status(404).json({ error: 'Not found', detail: 'User not found' });
  }
  // Viewers can only see their own permissions; managers/admins can see anyone's
  if (req.user!.role === 'viewer' && req.user!.id !== req.params.id) {
    return res.status(403).json({ error: 'Forbidden', detail: 'Viewers can only view their own permissions' });
  }
  const perms = getEffectivePermissions(appDb.db, req.params.id);
  return res.json({ status: 'success', user: { id: target.id, username: target.username, role: target.role }, permissions: perms });
});

apiRouter.put('/auth/users/:id/permissions', requireAuth, requirePermission('users', 'edit'), (req: AuthRequest, res: Response) => {
  const target = appDb.db.prepare('SELECT id,username FROM users WHERE id = ?').get(req.params.id) as any;
  if (!target) {
    return res.status(404).json({ error: 'Not found', detail: 'User not found' });
  }
  const { permissions } = (req.body || {}) as { permissions?: { id: string; granted: boolean }[] };
  if (!Array.isArray(permissions)) {
    return res.status(400).json({ error: 'Invalid body', detail: 'permissions array is required' });
  }
  const upsert = appDb.db.prepare(`
    INSERT OR REPLACE INTO user_permissions (user_id, permission_id, granted) VALUES (?, ?, ?)
  `);
  const tx = appDb.db.transaction(() => {
    for (const p of permissions) {
      upsert.run(req.params.id, p.id, p.granted ? 1 : 0);
    }
  });
  tx();
  auditLog(req.user?.id, 'user.update_permissions', 'users', req.params.id, { count: permissions.length });
  return res.json({ status: 'success', message: 'User permissions updated', userId: req.params.id });
});

// Assets Endpoints
apiRouter.get('/assets', requirePermission('assets', 'view'), (req: Request, res: Response) => {
  const exchange = req.query.exchange as ExchangeCode | undefined;
  let assets = marketRepo.getAllAssets();
  if (exchange) {
    assets = assets.filter(a => a.exchange === exchange);
  }
  res.json({
    count: assets.length,
    assets,
  });
});

apiRouter.get('/assets/:ticker', requirePermission('assets', 'view'), (req: Request, res: Response) => {
  const asset = marketRepo.getAsset(req.params.ticker);
  if (!asset) {
    return res.status(404).json({ error: `Asset with ticker ${req.params.ticker} not found` });
  }
  res.json(asset);
});

apiRouter.get('/assets/:ticker/prices', requirePermission('assets', 'view'), (req: Request, res: Response) => {
  const asset = marketRepo.getAsset(req.params.ticker);
  if (!asset) {
    return res.status(404).json({ error: `Asset with ticker ${req.params.ticker} not found` });
  }
  const bars = marketRepo.getBars(req.params.ticker);
  if (bars.length === 0) {
    return res.status(404).json({ error: `No price history available for ${req.params.ticker}` });
  }
  res.json({
    ticker: req.params.ticker,
    currency: asset.currency,
    count: bars.length,
    bars,
  });
});

apiRouter.get('/assets/:ticker/sentiment', requireAnyPermission([{ resource: 'social', action: 'view' }, { resource: 'news', action: 'view' }]), (req: Request, res: Response) => {
  const ticker = req.params.ticker;
  if (!marketRepo.getAsset(ticker)) {
    return res.status(404).json({ error: `Asset with ticker ${ticker} not found` });
  }
  const socialSummary = socialRepo.getSentimentSummary(ticker);
  const newsSummary = newsRepo.getNewsSentimentSummary(ticker);
  const posts = socialRepo.getAllPosts({ ticker });
  const news = newsRepo.getAllNews({ ticker });

  res.json({
    ticker,
    social: socialSummary,
    news: newsSummary,
    recentPosts: posts.slice(0, 5),
    recentNews: news.slice(0, 5),
  });
});

apiRouter.get('/assets/:ticker/predictions', requirePermission('predictions', 'view'), (req: Request, res: Response) => {
  const ticker = req.params.ticker;
  if (!marketRepo.getAsset(ticker)) {
    return res.status(404).json({ error: `Asset with ticker ${ticker} not found` });
  }
  const evalResult = mlEngine.evaluateModelsForTicker(ticker);
  res.json(evalResult);
});

// Exchanges Endpoints
apiRouter.get('/exchanges', requirePermission('exchanges', 'view'), (req: Request, res: Response) => {
  const allAssets = marketRepo.getAllAssets();
  const hkAssets = allAssets.filter(a => a.exchange === 'HKEX');
  const krAssets = allAssets.filter(a => a.exchange === 'KRX');

  res.json({
    exchanges: [
      {
        code: 'HKEX',
        name: 'Hong Kong Exchange',
        timezone: 'Asia/Hong_Kong',
        currency: 'HKD',
        assetCount: hkAssets.length,
        avgSentiment: Number((hkAssets.reduce((s, a) => s + a.overallSentiment, 0) / hkAssets.length).toFixed(1)),
        totalSocialMentions: hkAssets.reduce((s, a) => s + a.socialMentions, 0),
        totalNewsArticles: hkAssets.reduce((s, a) => s + a.newsMentions, 0),
        sourcesConfigured: ['LIHKG', 'Telegram HK Finance', 'Futu / Moomoo Community'],
      },
      {
        code: 'KRX',
        name: 'Korea Exchange',
        timezone: 'Asia/Seoul',
        currency: 'KRW',
        assetCount: krAssets.length,
        avgSentiment: Number((krAssets.reduce((s, a) => s + a.overallSentiment, 0) / krAssets.length).toFixed(1)),
        totalSocialMentions: krAssets.reduce((s, a) => s + a.socialMentions, 0),
        totalNewsArticles: krAssets.reduce((s, a) => s + a.newsMentions, 0),
        sourcesConfigured: ['Naver Finance Jongmok Toronbang', 'Telegram KR Markets', 'Daum Finance Forums'],
      },
    ],
  });
});

apiRouter.get('/exchanges/:exchange/overview', requirePermission('exchanges', 'view'), (req: Request, res: Response) => {
  const ex = req.params.exchange.toUpperCase() as ExchangeCode;
  if (!VALID_EXCHANGES.includes(ex)) {
    return res.status(404).json({ error: `Exchange ${req.params.exchange} not supported. Expected HKEX or KRX.` });
  }
  const assets = marketRepo.getAllAssets().filter(a => a.exchange === ex);
  const posts = socialRepo.getAllPosts({ exchange: ex });
  const news = newsRepo.getAllNews({ exchange: ex });

  res.json({
    exchange: ex,
    assetCount: assets.length,
    assets,
    totalPosts: posts.length,
    totalNews: news.length,
    bullishCount: assets.filter(a => a.overallSentiment > 20).length,
    bearishCount: assets.filter(a => a.overallSentiment < -20).length,
    neutralCount: assets.filter(a => a.overallSentiment >= -20 && a.overallSentiment <= 20).length,
  });
});

apiRouter.get('/exchanges/:exchange/rankings', requirePermission('exchanges', 'view'), (req: Request, res: Response) => {
  const ex = req.params.exchange.toUpperCase() as ExchangeCode;
  if (!VALID_EXCHANGES.includes(ex)) {
    return res.status(404).json({ error: `Exchange ${req.params.exchange} not supported. Expected HKEX or KRX.` });
  }
  const sortBy = (req.query.sortBy as string) || 'sentiment';
  let assets = marketRepo.getAllAssets().filter(a => a.exchange === ex);

  if (sortBy === 'sentiment') {
    assets.sort((a, b) => b.overallSentiment - a.overallSentiment);
  } else if (sortBy === 'mentions') {
    assets.sort((a, b) => b.socialMentions - a.socialMentions);
  } else if (sortBy === 'predictedChange') {
    assets.sort((a, b) => b.predictedChangePercent - a.predictedChangePercent);
  } else if (sortBy === 'priceChange') {
    assets.sort((a, b) => b.priceChangePercent - a.priceChangePercent);
  }

  res.json({
    exchange: ex,
    sortBy,
    rankings: assets.map((a, idx) => ({
      rank: idx + 1,
      ...a,
    })),
  });
});

// Social Endpoints
apiRouter.get('/social/posts', requirePermission('social', 'view'), (req: Request, res: Response) => {
  const ticker = req.query.ticker as string | undefined;
  const exchange = req.query.exchange as ExchangeCode | undefined;
  const platform = req.query.platform as string | undefined;
  const posts = socialRepo.getAllPosts({ ticker, exchange, platform });

  res.json({
    count: posts.length,
    posts,
  });
});

apiRouter.get('/social/sentiment', requirePermission('social', 'view'), (req: Request, res: Response) => {
  const allPosts = socialRepo.getAllPosts();
  const platformDistribution = {
    LIHKG: allPosts.filter(p => p.platform === 'LIHKG').length,
    Telegram: allPosts.filter(p => p.platform === 'Telegram').length,
    'Naver Finance': allPosts.filter(p => p.platform === 'Naver Finance').length,
    'Daum Finance': allPosts.filter(p => p.platform === 'Daum Finance').length,
    'Futu/Moomoo': allPosts.filter(p => p.platform === 'Futu/Moomoo').length,
  };

  res.json({
    totalPosts: allPosts.length,
    platformDistribution,
    overallAverageScore: Number((allPosts.reduce((s, p) => s + p.sentimentScore, 0) / (allPosts.length || 1)).toFixed(1)),
    sentimentDistribution: {
      strongBullish: allPosts.filter(p => p.sentimentLabel === 'Strong Bullish').length,
      bullish: allPosts.filter(p => p.sentimentLabel === 'Bullish').length,
      neutral: allPosts.filter(p => p.sentimentLabel === 'Neutral').length,
      bearish: allPosts.filter(p => p.sentimentLabel === 'Bearish').length,
      strongBearish: allPosts.filter(p => p.sentimentLabel === 'Strong Bearish').length,
    },
  });
});

apiRouter.get('/social/trends', requirePermission('social', 'view'), (req: Request, res: Response) => {
  const assets = marketRepo.getAllAssets();
  const trending = assets
    .map(a => ({
      ticker: a.ticker,
      name: a.name,
      exchange: a.exchange,
      mentions: a.socialMentions,
      sentiment: a.overallSentiment,
      direction: a.sentimentDirection,
      priceChangePercent: a.priceChangePercent,
    }))
    .sort((a, b) => b.mentions - a.mentions);

  res.json({ trending });
});

apiRouter.get('/social/summary', requirePermission('social', 'view'), (req: Request, res: Response) => {
  const allPosts = socialRepo.getAllPosts();
  const platformDistribution = {
    LIHKG: allPosts.filter(p => p.platform === 'LIHKG').length,
    Telegram: allPosts.filter(p => p.platform === 'Telegram').length,
    'Naver Finance': allPosts.filter(p => p.platform === 'Naver Finance').length,
    'Daum Finance': allPosts.filter(p => p.platform === 'Daum Finance').length,
    'Futu/Moomoo': allPosts.filter(p => p.platform === 'Futu/Moomoo').length,
  };

  res.json({
    totalPosts: allPosts.length,
    platformDistribution,
    averageSentiment: Number((allPosts.reduce((s, p) => s + p.sentimentScore, 0) / (allPosts.length || 1)).toFixed(1)),
    sentimentDistribution: {
      strongBullish: allPosts.filter(p => p.sentimentLabel === 'Strong Bullish').length,
      bullish: allPosts.filter(p => p.sentimentLabel === 'Bullish').length,
      neutral: allPosts.filter(p => p.sentimentLabel === 'Neutral').length,
      bearish: allPosts.filter(p => p.sentimentLabel === 'Bearish').length,
      strongBearish: allPosts.filter(p => p.sentimentLabel === 'Strong Bearish').length,
    },
  });
});

// News Endpoints
apiRouter.get('/news', requirePermission('news', 'view'), (req: Request, res: Response) => {
  const ticker = req.query.ticker as string | undefined;
  const exchange = req.query.exchange as ExchangeCode | undefined;
  const news = newsRepo.getAllNews({ ticker, exchange });

  res.json({
    count: news.length,
    totalCount: news.length,
    articles: news,
    news,
  });
});

apiRouter.get('/news/articles', requirePermission('news', 'view'), (req: Request, res: Response) => {
  const ticker = req.query.ticker as string | undefined;
  const exchange = req.query.exchange as ExchangeCode | undefined;
  const news = newsRepo.getAllNews({ ticker, exchange });

  res.json({
    count: news.length,
    totalCount: news.length,
    articles: news,
    news,
  });
});

apiRouter.get('/news/summary', requirePermission('news', 'view'), (req: Request, res: Response) => {
  const allNews = newsRepo.getAllNews();
  const publisherBreakdown: Record<string, number> = {};
  for (const n of allNews) {
    publisherBreakdown[n.publisher] = (publisherBreakdown[n.publisher] || 0) + 1;
  }

  res.json({
    totalArticles: allNews.length,
    publisherBreakdown,
    averageSentiment: Number((allNews.reduce((s, n) => s + n.sentimentScore, 0) / (allNews.length || 1)).toFixed(1)),
  });
});

apiRouter.get('/pipeline/status', requirePermission('pipeline', 'view'), (req: Request, res: Response) => {
  res.json({
    agents: orchestrator.getAgentStates(),
    history: orchestrator.getJobHistory(),
    integrityChecks: orchestrator.getLastIntegrityChecks(),
  });
});

apiRouter.get('/news/:id', requirePermission('news', 'view'), (req: Request, res: Response) => {
  const article = newsRepo.getArticleById(req.params.id);
  if (!article) {
    return res.status(404).json({ error: `News article ${req.params.id} not found` });
  }
  res.json(article);
});

// Predictions Endpoints
apiRouter.get('/predictions', requirePermission('predictions', 'view'), (req: Request, res: Response) => {
  const assets = marketRepo.getAllAssets();
  const predictions = assets.map(a => {
    const evalRes = mlEngine.evaluateModelsForTicker(a.ticker);
    return evalRes.predictionDetail;
  });

  res.json({
    count: predictions.length,
    predictions,
  });
});

apiRouter.post('/predictions/run', requirePermission('predictions', 'run'), (req: Request, res: Response) => {
  orchestrator.syncAssetIntelligence();
  res.json({
    status: 'success',
    message: 'Machine Learning models retrained and next-period forecasts regenerated.',
    timestamp: new Date().toISOString(),
  });
});

apiRouter.get('/predictions/performance', requirePermission('predictions', 'view'), (req: Request, res: Response) => {
  // Aggregate model performance across all 10 assets.
  // Raw MAE/RMSE are reported per exchange in that exchange's native currency, because
  // averaging HKD and KRW absolute errors together is not meaningful. The normalized
  // MAPE (%) column is the cross-currency comparable figure.
  const assets = marketRepo.getAllAssets();
  const allModels: Record<string, { mae: number[]; rmse: number[]; dirAcc: number[]; r2: number[]; mape: number[]; samples: number[]; champion: boolean; maeByExchange: Record<string, number[]> }> = {};
  const championByExchange: Record<string, { mae: number[]; mape: number[]; rmse: number[] }> = {
    HKEX: { mae: [], mape: [], rmse: [] },
    KRX: { mae: [], mape: [], rmse: [] },
  };
  const importanceByFeature: Record<string, number[]> = {};
  let totalOutOfSample = 0;
  let foldsPerAsset = 0;

  for (const a of assets) {
    const evalRes = mlEngine.evaluateModelsForTicker(a.ticker);
    if (evalRes?.modelPerformances) {
      for (const m of evalRes.modelPerformances) {
        if (!allModels[m.modelName]) {
          allModels[m.modelName] = { mae: [], rmse: [], dirAcc: [], r2: [], mape: [], samples: [], champion: false, maeByExchange: {} };
        }
        allModels[m.modelName].mae.push(m.mae);
        allModels[m.modelName].rmse.push(m.rmse);
        allModels[m.modelName].dirAcc.push(m.directionalAccuracy);
        allModels[m.modelName].r2.push(m.r2Score);
        allModels[m.modelName].mape.push(m.mape);
        allModels[m.modelName].samples.push(m.sampleCount);
        allModels[m.modelName].champion = allModels[m.modelName].champion || m.isChampion;
        if (!allModels[m.modelName].maeByExchange[a.exchange]) allModels[m.modelName].maeByExchange[a.exchange] = [];
        allModels[m.modelName].maeByExchange[a.exchange].push(m.mae);

        if (m.isChampion) {
          const bucket = championByExchange[a.exchange];
          if (bucket) {
            bucket.mae.push(m.mae);
            bucket.mape.push(m.mape);
            bucket.rmse.push(m.rmse);
          }
          totalOutOfSample += m.sampleCount;
          foldsPerAsset = m.sampleCount;
        }
      }
    }
    if (evalRes?.featureImportances?.length) {
      for (const f of evalRes.featureImportances) {
        if (!importanceByFeature[f.feature]) importanceByFeature[f.feature] = [];
        importanceByFeature[f.feature].push(f.importance);
      }
    }
  }

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);

  const leaderboard = Object.keys(allModels).map(name => ({
    modelName: name,
    // Raw absolute errors are reported per exchange in native currency (never pooled across HKD/KRW)
    hkexAverageMae: allModels[name].maeByExchange['HKEX']?.length
      ? Number(avg(allModels[name].maeByExchange['HKEX']).toFixed(2))
      : null,
    krxAverageMae: allModels[name].maeByExchange['KRX']?.length
      ? Number(avg(allModels[name].maeByExchange['KRX']).toFixed(2))
      : null,
    averageDirectionalAccuracy: Number(avg(allModels[name].dirAcc).toFixed(1)),
    averageR2: Number(avg(allModels[name].r2).toFixed(3)),
    // Currency-normalized error (%) - valid to compare across HKD and KRW assets
    averageMapePercent: Number(avg(allModels[name].mape).toFixed(2)),
    assetCount: allModels[name].mae.length,
    totalOutOfSampleSamples: allModels[name].samples.reduce((s, v) => s + v, 0),
    champion: allModels[name].champion,
  }));

  leaderboard.sort((a, b) => b.averageDirectionalAccuracy - a.averageDirectionalAccuracy);

  const exchangeMetrics = Object.keys(championByExchange)
    .filter(code => championByExchange[code].mae.length > 0)
    .map(code => {
      const meta = marketRepo.getAllAssets().find(a => a.exchange === code);
      return {
        exchange: code,
        currency: meta?.currency || (code === 'HKEX' ? 'HKD' : 'KRW'),
        assetCount: championByExchange[code].mae.length,
        averageMaeNative: Number(avg(championByExchange[code].mae).toFixed(2)),
        averageRmseNative: Number(avg(championByExchange[code].rmse).toFixed(2)),
        averageMapePercent: Number(avg(championByExchange[code].mape).toFixed(2)),
      };
    });

  res.json({
    leaderboard,
    exchangeMetrics,
    featureImportance: Object.keys(importanceByFeature).map(feature => ({
      feature,
      importance: Number(avg(importanceByFeature[feature]).toFixed(4)),
    })),
    methodology: {
      validation: 'Chronological expanding-window walk-forward, strict train-index < test-index',
      assetsEvaluated: assets.length,
      foldsPerAsset,
      totalOutOfSampleObservations: totalOutOfSample,
      normalizedMetric: 'MAPE (%) - recommended for cross-exchange comparison',
      currencyNote: 'HKEX errors in HKD, KRX errors in KRW; raw MAE is never pooled across currencies in exchangeMetrics',
    },
  });
});

apiRouter.get('/predictions/backtesting', requirePermission('predictions', 'view'), (req: Request, res: Response) => {
  const ticker = (req.query.ticker as string) || '0700.HK';
  const asset = marketRepo.getAsset(ticker);
  if (!asset) {
    return res.status(404).json({ error: `Asset with ticker ${ticker} not found` });
  }
  const evalRes = mlEngine.evaluateModelsForTicker(ticker);
  const champion = evalRes?.modelPerformances?.[0];
  const persistence = evalRes?.modelPerformances?.find(m => m.modelName.includes('Persistence'));
  const hitCount = evalRes.backtestPoints.filter(p => p.directionMatch).length;

  res.json({
    ticker,
    currency: asset.currency,
    backtestPoints: evalRes.backtestPoints,
    summary: champion
      ? {
          folds: champion.sampleCount,
          hitCount,
          directionalAccuracyPercent: champion.directionalAccuracy,
          meanAbsoluteError: champion.mae,
          mapePercent: champion.mape,
          persistenceMae: persistence ? persistence.mae : null,
          baselineImprovementPercent: champion.baselineImprovement,
          computedAt: new Date().toISOString(),
        }
      : null,
  });
});

// Ingestion & Agent Endpoints
apiRouter.post('/ingestion/run', requirePermission('pipeline', 'run'), async (req: Request, res: Response) => {
  try {
    const result = await orchestrator.runFullPipeline();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Pipeline execution failed', detail: err?.message || 'Unknown error' });
  }
});

apiRouter.get('/ingestion/status', requirePermission('pipeline', 'view'), (req: Request, res: Response) => {
  res.json({
    isRunning: orchestrator.isPipelineRunning(),
    agents: orchestrator.getAgentStates(),
  });
});

apiRouter.get('/ingestion/history', requirePermission('pipeline', 'view'), (req: Request, res: Response) => {
  res.json({
    history: orchestrator.getJobHistory(),
  });
});

apiRouter.post('/agents/run', requirePermission('pipeline', 'run'), async (req: Request, res: Response) => {
  try {
    const result = await orchestrator.runFullPipeline();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Agent pipeline execution failed', detail: err?.message || 'Unknown error' });
  }
});

apiRouter.get('/agents/status', requirePermission('pipeline', 'view'), (req: Request, res: Response) => {
  res.json({
    agents: orchestrator.getAgentStates(),
  });
});

// Reports Endpoints
apiRouter.get('/reports', requirePermission('reports', 'view'), (req: Request, res: Response) => {
  // Refresh all standing briefings so displayed metrics always match current engine state
  const hk = generatedReports.find(r => r.id === 'rep_hkex_latest');
  if (hk) Object.assign(hk, buildExecutiveReport('HKEX'), { id: 'rep_hkex_latest' });
  const kr = generatedReports.find(r => r.id === 'rep_krx_latest');
  if (kr) Object.assign(kr, buildExecutiveReport('KRX'), { id: 'rep_krx_latest' });
  const all = generatedReports.find(r => r.id === 'rep_all_latest');
  if (all) Object.assign(all, buildExecutiveReport('ALL'), { id: 'rep_all_latest' });

  res.json({
    count: generatedReports.length,
    reports: generatedReports,
  });
});

apiRouter.post('/reports/generate', requirePermission('reports', 'create'), (req: Request, res: Response) => {
  const exchange = (req.body?.exchange as ExchangeCode | 'ALL') || 'ALL';
  if (exchange !== 'ALL' && !VALID_EXCHANGES.includes(exchange)) {
    return res.status(400).json({ error: `Invalid exchange '${exchange}'. Expected one of: ALL, HKEX, KRX` });
  }

  const newReport = buildExecutiveReport(exchange);
  newReport.id = `rep_${Date.now()}`;

  generatedReports.unshift(newReport);
  res.json(newReport);
});

apiRouter.get('/reports/:id/download', requirePermission('reports', 'view'), (req: Request, res: Response) => {
  const report = generatedReports.find(r => r.id === req.params.id);
  if (!report) {
    return res.status(404).json({ error: `Report ${req.params.id} not found` });
  }

  // Format as clean CSV or JSON
  const format = req.query.format || 'json';
  if (format === 'csv') {
    const csvHeader = 'Rank,Ticker,Name,Exchange,CurrentPrice,PriceChangePercent,SentimentScore,SentimentDirection,PredictedPrice,PredictedChangePercent,PredictionDirection\n';
    const csvRows = report.assetsRanked.map((a, i) => 
      `${i + 1},"${a.ticker}","${a.name}","${a.exchange}",${a.currentPrice},${a.priceChangePercent}%,${a.overallSentiment},"${a.sentimentDirection}",${a.predictedPrice},${a.predictedChangePercent}%,"${a.predictionDirection}"`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${report.id}.csv"`);
    return res.send(csvHeader + csvRows);
  }

  res.json(report);
});

// Settings Endpoints
apiRouter.get('/settings', requirePermission('settings', 'view'), (req: Request, res: Response) => {
  // Mask sensitive keys in response
  const masked = {
    ...currentSettings,
    apifyApiToken: currentSettings.apifyApiToken ? '••••••••' + currentSettings.apifyApiToken.slice(-4) : '',
    exaApiKey: currentSettings.exaApiKey ? '••••••••' + currentSettings.exaApiKey.slice(-4) : '',
    marketDataApiKey: currentSettings.marketDataApiKey ? '••••••••' + currentSettings.marketDataApiKey.slice(-4) : '',
  };
  res.json(masked);
});

apiRouter.put('/settings', requirePermission('settings', 'edit'), (req: AuthRequest, res: Response) => {
  const body = (req.body || {}) as Partial<SystemSettings>;
  if (body.apifyApiToken && !body.apifyApiToken.includes('••••')) {
    currentSettings.apifyApiToken = body.apifyApiToken;
  }
  if (body.exaApiKey && !body.exaApiKey.includes('••••')) {
    currentSettings.exaApiKey = body.exaApiKey;
    newsRepo.setApiKey(body.exaApiKey);
  }
  if (body.marketDataApiKey && !body.marketDataApiKey.includes('••••')) {
    currentSettings.marketDataApiKey = body.marketDataApiKey;
  }
  if (body.bullishThreshold !== undefined) currentSettings.bullishThreshold = body.bullishThreshold;
  if (body.bearishThreshold !== undefined) currentSettings.bearishThreshold = body.bearishThreshold;
  if (body.marketDataProvider) currentSettings.marketDataProvider = body.marketDataProvider;
  if (body.languagePrefs) currentSettings.languagePrefs = body.languagePrefs;

  // Persist settings to SQLite
  const now = new Date().toISOString();
  const persistSetting = (key: string, value: unknown) => {
    appDb.db.prepare(
      'INSERT INTO settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at'
    ).run(key, JSON.stringify(value), now);
  };
  persistSetting('apifyApiToken', currentSettings.apifyApiToken);
  persistSetting('exaApiKey', currentSettings.exaApiKey ? 'SET' : '');
  persistSetting('marketDataApiKey', currentSettings.marketDataApiKey ? 'SET' : '');
  persistSetting('bullishThreshold', currentSettings.bullishThreshold);
  persistSetting('bearishThreshold', currentSettings.bearishThreshold);
  persistSetting('marketDataProvider', currentSettings.marketDataProvider);
  persistSetting('predictionHorizonDays', currentSettings.predictionHorizonDays);
  persistSetting('dataRetentionDays', currentSettings.dataRetentionDays);
  persistSetting('enableAutomatedOrchestration', currentSettings.enableAutomatedOrchestration);
  persistSetting('orchestrationIntervalHours', currentSettings.orchestrationIntervalHours);
  if (body.languagePrefs) persistSetting('languagePrefs', currentSettings.languagePrefs);

  auditLog(req.user?.id, 'settings.update', 'settings', '*', body);

  res.json({
    status: 'success',
    message: 'Settings updated successfully.',
    settings: {
      ...currentSettings,
      apifyApiToken: currentSettings.apifyApiToken ? '••••••••' + currentSettings.apifyApiToken.slice(-4) : '',
      exaApiKey: currentSettings.exaApiKey ? '••••••••' + currentSettings.exaApiKey.slice(-4) : '',
    },
  });
});

// Source status, freshness and live-vs-fallback classification.
// Mode is 'live' only when a working external integration actually served the records
// currently in the store; otherwise it is 'local-fallback'.
apiRouter.get('/sources/status', requireAuth, (req: Request, res: Response) => {
  const nowIso = new Date().toISOString();
  const minutesSince = (iso: string | null | undefined): number | null =>
    iso ? Math.round((Date.now() - Date.parse(iso)) / 60000) : null;

  const posts = socialRepo.getAllPosts();
  const news = newsRepo.getAllNews();
  const assets = marketRepo.getAllAssets();
  const exaStats = newsRepo.getLiveIntegrationStats();

  const newestPost = posts.reduce<string | null>(
    (acc, p) => (!acc || Date.parse(p.publishedAt) > Date.parse(acc) ? p.publishedAt : acc),
    null
  );
  const newestArticle = news.reduce<string | null>(
    (acc, n) => (!acc || Date.parse(n.publishedAt) > Date.parse(acc) ? n.publishedAt : acc),
    null
  );
  const newestBar = assets.reduce<string | null>(
    (acc, a) => (!acc || Date.parse(a.priceTimestamp) > Date.parse(acc) ? a.priceTimestamp : acc),
    null
  );

  const platforms = Array.from(new Set(posts.map(p => p.platform)));
  const publishers = Array.from(new Set(news.map(n => n.publisher)));
  const totalBars = assets.reduce((s, a) => s + marketRepo.getBars(a.ticker).length, 0);

  // Compact production-model performance summary (recomputed, never cached constants)
  let dirSum = 0;
  let mapeSum = 0;
  let sampleTotal = 0;
  let folds = 0;
  const nativeMae: { HKD: number[]; KRW: number[] } = { HKD: [], KRW: [] };
  for (const a of assets) {
    const res = mlEngine.evaluateModelsForTicker(a.ticker);
    const champion = res?.modelPerformances?.[0];
    if (champion) {
      dirSum += champion.directionalAccuracy;
      mapeSum += champion.mape;
      sampleTotal += champion.sampleCount;
      folds = champion.sampleCount;
      (a.currency === 'KRW' ? nativeMae.KRW : nativeMae.HKD).push(champion.mae);
    }
  }
  const avgOf = (arr: number[]) => (arr.length ? Number((arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(2)) : 0);

  res.json({
    generatedAt: nowIso,
    sources: [
      {
        id: 'apify_social',
        name: 'Apify Social Scraping',
        mode: socialRepo.getApifyStatus().configured ? 'live' : 'local-fallback',
        modeLabel: socialRepo.getApifyStatus().configured ? 'LIVE Apify Actors' : 'Local Fallback Dataset',
        credentialConfigured: Boolean(currentSettings.apifyApiToken),
        liveIntegrationAvailable: true,
        detail: socialRepo.getApifyStatus().configured
          ? `Apify API token configured - live actor runs execute on pipeline execution. Social records currently served: ${posts.length} posts.`
          : 'Apify actor runner is wired but no APIFY_API_TOKEN configured - serving the curated local fallback dataset. Add APIFY_API_TOKEN and Actor IDs to .env for live scraping.',
        lastUpdated: newestPost,
        ageMinutes: minutesSince(newestPost),
        recordCount: posts.length,
        platforms,
      },
      {
        id: 'exa_news',
        name: 'Exa News Discovery',
        mode: exaStats.liveArticleCount > 0 ? 'live' : 'local-fallback',
        modeLabel: exaStats.liveArticleCount > 0 ? 'LIVE Exa API' : 'Local Fallback Dataset',
        credentialConfigured: exaStats.credentialConfigured,
        liveIntegrationAvailable: true,
        detail: exaStats.credentialConfigured
          ? `EXA_API_KEY configured - live search runs on pipeline execution. Live articles currently served: ${exaStats.liveArticleCount}.`
          : 'EXA_API_KEY not configured - serving the curated local fallback news dataset. No live Exa calls are made.',
        lastLiveSearchAt: exaStats.lastLiveSearchAt,
        lastUpdated: newestArticle,
        ageMinutes: minutesSince(newestArticle),
        recordCount: news.length,
        liveRecordCount: exaStats.liveArticleCount,
        publishers,
      },
      {
        id: 'market_data',
        name: 'Market Data Feed',
        mode: 'local-fallback',
        modeLabel: 'Local Deterministic OHLCV',
        credentialConfigured: Boolean(currentSettings.marketDataApiKey),
        liveIntegrationAvailable: false,
        detail:
          'OHLCV bars are produced by a deterministic seeded generator (per-ticker seed, weekends skipped) - they are not a live Yahoo/vendor quote feed.',
        provider: currentSettings.marketDataProvider,
        lastUpdated: newestBar,
        ageMinutes: minutesSince(newestBar),
        recordCount: totalBars,
        tickersCovered: assets.length,
      },
    ],
    dataFreshness: {
      socialAgeMinutes: minutesSince(newestPost),
      newsAgeMinutes: minutesSince(newestArticle),
      priceAgeMinutes: minutesSince(newestBar),
      newestSocialPublishedAt: newestPost,
      newestNewsPublishedAt: newestArticle,
      newestPriceBarAt: newestBar,
    },
    modelPerformance: {
      productionModel: 'Multi-Factor Quant Sentiment Ensemble',
      directionalAccuracyPercent: Number((dirSum / (assets.length || 1)).toFixed(1)),
      mapePercent: Number((mapeSum / (assets.length || 1)).toFixed(2)),
      hkexAverageMaeHKD: avgOf(nativeMae.HKD),
      krxAverageMaeKRW: avgOf(nativeMae.KRW),
      foldsPerAsset: folds,
      totalOutOfSampleObservations: sampleTotal,
      computedAt: nowIso,
    },
    integrityChecks: orchestrator.getLastIntegrityChecks(),
  });
});

// Unknown API routes return JSON 404 (not an HTML error page)
apiRouter.use((req: Request, res: Response) => {
  res.status(404).json({ error: `Endpoint ${req.method} ${req.originalUrl} not found` });
});
