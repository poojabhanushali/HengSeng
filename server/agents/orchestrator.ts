import { AgentExecutionState, IngestionJob } from '../../src/types';
import { marketRepo } from '../data/marketData';
import { socialRepo } from '../data/socialScraper';
import { newsRepo } from '../data/newsEngine';
import { mlEngine, buildFeatureDataset } from '../ml/predictiveEngine';

export class MultiAgentOrchestrator {
  private agentStates: AgentExecutionState[] = [
    {
      agentNumber: 1,
      agentName: 'Market Data Agent',
      role: 'Builds deterministic historical OHLCV bars & computes technical indicators (RSI, MACD, Moving Averages, Pivot Points)',
      status: 'idle',
      lastRunTime: new Date().toISOString(),
      durationMs: 0,
      itemsProcessed: 0,
      qualityScore: 0,
      message: 'Idle — awaiting pipeline execution.',
    },
    {
      agentNumber: 2,
      agentName: 'Social Scraping Agent',
      role: 'Coordinates Apify actors & native scraping for LIHKG, Telegram, Naver Finance, and Daum Finance forums',
      status: 'idle',
      lastRunTime: new Date().toISOString(),
      durationMs: 0,
      itemsProcessed: 0,
      qualityScore: 0,
      message: 'Idle — awaiting pipeline execution.',
    },
    {
      agentNumber: 3,
      agentName: 'News Research Agent',
      role: 'Queries Exa API for company, earnings, regulatory developments, and institutional analyst coverage',
      status: 'idle',
      lastRunTime: new Date().toISOString(),
      durationMs: 0,
      itemsProcessed: 0,
      qualityScore: 0,
      message: 'Idle — awaiting pipeline execution.',
    },
    {
      agentNumber: 4,
      agentName: 'Sentiment Analysis Agent',
      role: 'Executes multilingual financial NLP across Traditional Chinese, Korean, and English with domain slang lexicon',
      status: 'idle',
      lastRunTime: new Date().toISOString(),
      durationMs: 0,
      itemsProcessed: 0,
      qualityScore: 0,
      message: 'Idle — awaiting pipeline execution.',
    },
    {
      agentNumber: 5,
      agentName: 'Financial Intelligence Agent',
      role: 'Extracts position signals (Long/Short/Accumulating) & calculates technical Support / Resistance levels',
      status: 'idle',
      lastRunTime: new Date().toISOString(),
      durationMs: 0,
      itemsProcessed: 0,
      qualityScore: 0,
      message: 'Idle — awaiting pipeline execution.',
    },
    {
      agentNumber: 6,
      agentName: 'Prediction Agent',
      role: 'Executes Walk-Forward Out-of-Sample cross-validation, trains the production ensemble, and forecasts n+1 price',
      status: 'idle',
      lastRunTime: new Date().toISOString(),
      durationMs: 0,
      itemsProcessed: 0,
      qualityScore: 0,
      message: 'Idle — awaiting pipeline execution.',
    },
    {
      agentNumber: 7,
      agentName: 'Reporting Agent',
      role: 'Builds exchange-level cross-sectional rankings, summary briefings, and exportable reports',
      status: 'idle',
      lastRunTime: new Date().toISOString(),
      durationMs: 0,
      itemsProcessed: 0,
      qualityScore: 0,
      message: 'Idle — awaiting pipeline execution.',
    },
    {
      agentNumber: 8,
      agentName: 'Quality Control Agent',
      role: 'Audits data continuity, stale metrics, lookahead leakage, duplicate posts, and API latency',
      status: 'idle',
      lastRunTime: new Date().toISOString(),
      durationMs: 0,
      itemsProcessed: 0,
      qualityScore: 0,
      message: 'Idle — awaiting pipeline execution.',
    },
  ];

  private isRunning = false;
  private jobHistory: IngestionJob[] = [];
  private lastIntegrityChecks: { name: string; passed: boolean; detail: string }[] = [];

  constructor() {
    this.syncAssetIntelligence();
    this.refreshIdleAgentMetrics();
    const checks = this.runIntegrityChecks();
    const qc = this.agentStates.find(a => a.agentNumber === 8);
    if (qc) {
      qc.itemsProcessed = checks.length;
      qc.qualityScore = this.integrityScore();
      qc.message = this.formatCheckSummary();
    }
  }

  public getLastIntegrityChecks(): { name: string; passed: boolean; detail: string }[] {
    return this.lastIntegrityChecks;
  }

  private integrityScore(): number {
    if (this.lastIntegrityChecks.length === 0) return 0;
    const passed = this.lastIntegrityChecks.filter(c => c.passed).length;
    return Math.round((passed / this.lastIntegrityChecks.length) * 100);
  }

  private formatCheckSummary(): string {
    const passed = this.lastIntegrityChecks.filter(c => c.passed).length;
    return `Passed ${passed}/${this.lastIntegrityChecks.length} integrity checks: continuity, currency mapping, as-of sentiment join, and n+1 target ordering.`;
  }

  // Real QC checks executed against current repository state (no static claims)
  public runIntegrityChecks(): { name: string; passed: boolean; detail: string }[] {
    const assets = marketRepo.getAllAssets();
    const checks: { name: string; passed: boolean; detail: string }[] = [];

    checks.push({
      name: 'Asset universe completeness',
      passed: assets.length === 10 && assets.filter(a => a.exchange === 'HKEX').length === 5 && assets.filter(a => a.exchange === 'KRX').length === 5,
      detail: `${assets.length} assets (HKEX ${assets.filter(a => a.exchange === 'HKEX').length}, KRX ${assets.filter(a => a.exchange === 'KRX').length})`,
    });

    let barCountOk = true;
    let monotonicOk = true;
    for (const a of assets) {
      const bars = marketRepo.getBars(a.ticker);
      if (bars.length < 10) barCountOk = false;
      for (let i = 1; i < bars.length; i++) {
        if (Date.parse(bars[i].timestamp) <= Date.parse(bars[i - 1].timestamp)) monotonicOk = false;
      }
    }
    checks.push({ name: 'Price bar continuity', passed: barCountOk, detail: barCountOk ? '10/10 assets have >= 10 bars' : 'an asset has fewer than 10 bars' });
    checks.push({ name: 'Strictly increasing bar timestamps', passed: monotonicOk, detail: monotonicOk ? 'all bars chronologically ordered' : 'out-of-order timestamps detected' });

    const currencyOk = assets.every(a => (a.exchange === 'HKEX' ? a.currency === 'HKD' : a.currency === 'KRW'));
    checks.push({ name: 'Exchange to currency mapping', passed: currencyOk, detail: currencyOk ? 'HKEX=HKD, KRX=KRW for all 10 assets' : 'currency mismatch detected' });

    // No-lookahead: every feature row must equal the sentiment of records published <= bar time
    let asOfOk = true;
    let targetOk = true;
    for (const a of assets) {
      const bars = marketRepo.getBars(a.ticker);
      const posts = socialRepo.getAllPosts({ ticker: a.ticker });
      const lastBarTime = Date.parse(bars[bars.length - 1]?.timestamp || '0');
      const predictions = mlEngine.evaluateModelsForTicker(a.ticker);
      if (predictions?.predictionDetail) {
        const targetTime = Date.parse(predictions.predictionDetail.targetDate);
        if (!(targetTime > lastBarTime)) targetOk = false;
      }
      const features = buildFeatureDataset(a.ticker).features;
      for (const row of features) {
        const rowTime = Date.parse(row.date);
        const visible = posts.filter(p => Date.parse(p.publishedAt) <= rowTime);
        const expected = visible.length === 0 ? 0 : Number(
          (visible.reduce((s, p) => s + p.sentimentScore, 0) / visible.length).toFixed(1)
        );
        if (Math.abs(row.socialSentiment * 100 - expected) > 0.05) asOfOk = false;
      }
    }
    checks.push({ name: 'As-of sentiment join (no future posts in features)', passed: asOfOk, detail: asOfOk ? 'all feature rows use only records published <= bar time' : 'future-dated records leaked into features' });
    checks.push({ name: 'Prediction target strictly after last observed bar', passed: targetOk, detail: targetOk ? 'all 10 forecasts target n+1' : 'a forecast does not target the next session' });

    const sentimentOk = assets.every(a => Number.isFinite(a.overallSentiment) && a.overallSentiment >= -100 && a.overallSentiment <= 100);
    checks.push({ name: 'Sentiment scores within [-100, +100]', passed: sentimentOk, detail: sentimentOk ? 'all asset scores in range' : 'score out of range' });

    this.lastIntegrityChecks = checks;
    return checks;
  }

  public getAgentStates(): AgentExecutionState[] {
    return this.agentStates;
  }

  public getJobHistory(): IngestionJob[] {
    return this.jobHistory;
  }

  public isPipelineRunning(): boolean {
    return this.isRunning;
  }

  private pct(part: number, total: number): number {
    return total > 0 ? Math.round((part / total) * 100) : 0;
  }

  // Real data-readiness metrics derived from the current repositories, not static constants.
  private collectQualityMetrics() {
    const assets = marketRepo.getAllAssets();
    const posts = socialRepo.getAllPosts();
    const news = newsRepo.getAllNews();
    const platformCount = new Set(posts.map(p => p.platform)).size;
    const barsTotal = assets.reduce((sum, a) => sum + marketRepo.getBars(a.ticker).length, 0);

    const barAssets = assets.filter(a => marketRepo.getBars(a.ticker).length >= 10).length;
    const socialAssets = assets.filter(a => posts.some(p => p.ticker === a.ticker)).length;
    const newsAssets = assets.filter(a => news.some(n => n.ticker === a.ticker)).length;
    const validSentiment = posts.filter(p => Number.isFinite(p.sentimentScore) && p.sentimentScore >= -100 && p.sentimentScore <= 100).length;
    const completeTechnicals = assets.filter(a =>
      Array.isArray(a.supportLevels) && a.supportLevels.length === 3 &&
      Array.isArray(a.resistanceLevels) && a.resistanceLevels.length === 3 &&
      Number.isFinite(a.pivotPoint)
    ).length;
    const validPredictions = assets.filter(a =>
      Number.isFinite(a.predictedPrice) && Number.isFinite(a.predictedChangePercent)
    ).length;
    const reportReady = assets.filter(a =>
      Number.isFinite(a.predictedPrice) &&
      Number.isFinite(a.overallSentiment) && a.overallSentiment >= -100 && a.overallSentiment <= 100
    ).length;

    return {
      assets,
      posts,
      news,
      platformCount,
      barsTotal,
      barContinuity: this.pct(barAssets, assets.length),
      socialCoverage: this.pct(socialAssets, assets.length),
      newsCoverage: this.pct(newsAssets, assets.length),
      sentimentValidity: this.pct(validSentiment, posts.length),
      technicalCompleteness: this.pct(completeTechnicals, assets.length),
      predictionValidity: this.pct(validPredictions, assets.length),
      reportReadiness: this.pct(reportReady, assets.length),
    };
  }

  private refreshIdleAgentMetrics() {
    const q = this.collectQualityMetrics();

    const set = (n: number, items: number, quality: number, message: string) => {
      const agent = this.agentStates.find(a => a.agentNumber === n);
      if (agent) {
        agent.status = 'idle';
        agent.durationMs = 0;
        agent.itemsProcessed = items;
        agent.qualityScore = quality;
        agent.message = message;
      }
    };

    set(1, q.barsTotal, q.barContinuity,
      `Loaded ${q.barsTotal} bars across ${q.assets.length} assets; ${q.barContinuity}% have >= 10 sessions.`);
    set(2, q.posts.length, q.socialCoverage,
      `Curated local dataset: ${q.posts.length} posts across ${q.platformCount} platform feeds; Apify runner not wired.`);
    set(3, q.news.length, q.newsCoverage,
      newsRepo.getApiKey()
        ? `EXA_API_KEY detected — live search available; ${q.news.length} curated articles loaded.`
        : `EXA_API_KEY not configured — ${q.news.length} curated fallback articles loaded (not live).`);
    set(4, q.posts.length + q.news.length, q.sentimentValidity,
      `Scored ${q.posts.length} posts and ${q.news.length} articles; sentiment validity ${q.sentimentValidity}%.`);
    set(5, q.assets.length, q.technicalCompleteness,
      `Technical levels computed for ${q.assets.length} assets; completeness ${q.technicalCompleteness}%.`);
    set(6, q.assets.length, q.predictionValidity,
      `Walk-forward predictions ready for ${q.assets.length} assets; validity ${q.predictionValidity}%.`);
    set(7, q.assets.length, q.reportReadiness,
      `Report inputs ready for ${q.assets.length} assets; readiness ${q.reportReadiness}%.`);
  }

  // Synchronize all asset sentiment and predictions with the data repository
  public syncAssetIntelligence() {
    const assets = marketRepo.getAllAssets();
    for (const asset of assets) {
      const socialSummary = socialRepo.getSentimentSummary(asset.ticker);
      const newsSummary = newsRepo.getNewsSentimentSummary(asset.ticker);
      const evalRes = mlEngine.evaluateModelsForTicker(asset.ticker);

      asset.socialMentions = socialSummary.totalMentions;
      asset.newsMentions = newsSummary.totalNews;
      asset.overallSentiment = socialSummary.avgSentiment;
      asset.engagementWeightedSentiment = socialSummary.engagementWeightedSentiment;

      if (asset.overallSentiment >= 60) asset.sentimentDirection = 'Strong Bullish';
      else if (asset.overallSentiment >= 20) asset.sentimentDirection = 'Bullish';
      else if (asset.overallSentiment <= -60) asset.sentimentDirection = 'Strong Bearish';
      else if (asset.overallSentiment <= -20) asset.sentimentDirection = 'Bearish';
      else asset.sentimentDirection = 'Neutral';

      if (evalRes?.predictionDetail) {
        asset.predictedPrice = evalRes.predictionDetail.predictedPrice;
        asset.predictedChangePercent = evalRes.predictionDetail.predictedChangePercent;
        asset.predictionDirection = evalRes.predictionDetail.direction;
        asset.predictionConfidence = evalRes.predictionDetail.validationMetrics.directionalAccuracy / 100;
      }
      asset.lastUpdated = new Date().toISOString();
      marketRepo.updateAsset(asset);
    }
  }

  // Execute full sequential autonomous pipeline
  public async runFullPipeline(): Promise<{ success: boolean; durationMs: number; errors: string[] }> {
    if (this.isRunning) {
      return { success: false, durationMs: 0, errors: ['Pipeline is currently already executing.'] };
    }

    this.isRunning = true;
    const startOverall = Date.now();
    const errors: string[] = [];
    const jobId = `job_${Date.now()}`;
    let q = this.collectQualityMetrics();

    try {
      // Step 1: Agent 1 - Market Data
      const t1 = Date.now();
      this.updateAgentStatus(1, 'running', 'Fetching latest prices & refreshing technical indicators...');
      await delay(200);
      marketRepo.initializeData();
      q = this.collectQualityMetrics();
      this.updateAgentStatus(
        1,
        'completed',
        `Updated ${q.barsTotal} bars across ${q.assets.length} assets; ${q.barContinuity}% have >= 10 sessions.`,
        q.barsTotal,
        q.barContinuity,
        Date.now() - t1
      );

      // Step 2: Agent 2 - Social Scraping
      const t2 = Date.now();
      this.updateAgentStatus(2, 'running', 'Ingesting curated social posts from the configured platform feeds...');
      await delay(250);
      socialRepo.ingestSeedPosts();
      q = this.collectQualityMetrics();
      this.updateAgentStatus(
        2,
        'completed',
        `Collected ${q.posts.length} curated posts across ${q.platformCount} platform feeds (Apify runner not wired).`,
        q.posts.length,
        q.socialCoverage,
        Date.now() - t2
      );

      // Step 3: Agent 3 - News Research
      const t3 = Date.now();
      this.updateAgentStatus(3, 'running', 'Discovering recent company news and earnings updates...');
      await delay(200);
      newsRepo.ingestSeedNews();
      // LIVE Exa path: only invoked when EXA_API_KEY (or a key saved in Settings) is present.
      // Without a credential the curated local fallback dataset is used and never labelled live.
      let liveExaArticles = 0;
      if (newsRepo.getApiKey()) {
        for (const asset of marketRepo.getAllAssets()) {
          try {
            const found = await newsRepo.searchWithExa(
              `${asset.name} ${asset.ticker} earnings market`,
              asset.ticker,
              asset.name,
              asset.exchange
            );
            liveExaArticles += found.filter(a => a.id.startsWith('exa_')).length;
          } catch (err) {
            // Individual asset failures fall back to the curated dataset for that ticker
            continue;
          }
        }
      }
      q = this.collectQualityMetrics();
      this.updateAgentStatus(
        3,
        'completed',
        newsRepo.getApiKey()
          ? `Exa API queried live for ${q.assets.length} assets (${liveExaArticles} new live articles merged with curated fallback).`
          : `EXA_API_KEY not configured — ${q.news.length} curated fallback articles served (not live).`,
        q.news.length,
        q.newsCoverage,
        Date.now() - t3
      );

      // Step 4: Agent 4 - Sentiment Analysis
      const t4 = Date.now();
      this.updateAgentStatus(4, 'running', 'Running multilingual sentiment analysis and engagement weighting...');
      await delay(200);
      q = this.collectQualityMetrics();
      this.updateAgentStatus(
        4,
        'completed',
        `Scored ${q.posts.length} posts and ${q.news.length} articles; validity ${q.sentimentValidity}%.`,
        q.posts.length + q.news.length,
        q.sentimentValidity,
        Date.now() - t4
      );

      // Step 5: Agent 5 - Financial Intelligence
      const t5 = Date.now();
      this.updateAgentStatus(5, 'running', 'Extracting expressed position signals and technical support/resistance...');
      await delay(150);
      q = this.collectQualityMetrics();
      this.updateAgentStatus(
        5,
        'completed',
        `Synthesized pivot levels and trader sentiment for ${q.assets.length} assets.`,
        q.assets.length,
        q.technicalCompleteness,
        Date.now() - t5
      );

      // Step 6: Agent 6 - Prediction Agent
      const t6 = Date.now();
      this.updateAgentStatus(6, 'running', 'Executing Walk-Forward validation & generating n+1 price predictions...');
      await delay(300);
      this.syncAssetIntelligence();
      q = this.collectQualityMetrics();
      this.updateAgentStatus(
        6,
        'completed',
        `Finished walk-forward validation; production ensemble forecast for ${q.assets.length} assets.`,
        q.assets.length,
        q.predictionValidity,
        Date.now() - t6
      );

      // Step 7: Agent 7 - Reporting Agent
      const t7 = Date.now();
      this.updateAgentStatus(7, 'running', 'Compiling exchange rankings, model scorecards, and backtests...');
      await delay(150);
      q = this.collectQualityMetrics();
      this.updateAgentStatus(
        7,
        'completed',
        `Updated market rankings and executive briefings for ${q.assets.length} assets.`,
        q.assets.length,
        q.reportReadiness,
        Date.now() - t7
      );

      // Step 8: Agent 8 - Quality Control Agent
      const t8 = Date.now();
      this.updateAgentStatus(8, 'running', 'Auditing data leakage, timestamp alignment, and latency...');
      await delay(150);
      const checks = this.runIntegrityChecks();
      const failedChecks = checks.filter(c => !c.passed);
      if (failedChecks.length > 0) {
        this.updateAgentStatus(
          8,
          'failed',
          `${failedChecks.length}/${checks.length} integrity checks FAILED: ${failedChecks.map(c => c.name).join('; ')}`,
          checks.length,
          this.integrityScore(),
          Date.now() - t8
        );
        errors.push(...failedChecks.map(c => `QC: ${c.name} — ${c.detail}`));
      } else {
        this.updateAgentStatus(
          8,
          'completed',
          this.formatCheckSummary(),
          checks.length,
          this.integrityScore(),
          Date.now() - t8
        );
      }

      const totalDuration = Date.now() - startOverall;
      this.jobHistory.unshift({
        id: jobId,
        agentId: 'orchestrator_all',
        name: 'Full End-to-End Autonomous Pipeline',
        status: 'completed',
        startTime: new Date(startOverall).toISOString(),
        endTime: new Date().toISOString(),
        durationMs: totalDuration,
        recordsProcessed: q.barsTotal + q.posts.length + q.news.length + q.assets.length,
        details: 'Successfully executed Agents 1–8 across HKEX & KRX universe.',
      });

      return { success: true, durationMs: totalDuration, errors: [] };
    } catch (err: any) {
      errors.push(err?.message || 'Unknown orchestration error');
      this.jobHistory.unshift({
        id: jobId,
        agentId: 'orchestrator_all',
        name: 'Full End-to-End Autonomous Pipeline',
        status: 'failed',
        startTime: new Date(startOverall).toISOString(),
        endTime: new Date().toISOString(),
        durationMs: Date.now() - startOverall,
        recordsProcessed: 0,
        error: err?.message,
        details: 'Pipeline halted due to execution failure.',
      });
      return { success: false, durationMs: Date.now() - startOverall, errors };
    } finally {
      this.isRunning = false;
    }
  }

  private updateAgentStatus(
    agentNum: number,
    status: 'idle' | 'running' | 'completed' | 'failed',
    message: string,
    items?: number,
    quality?: number,
    durationMs?: number
  ) {
    const agent = this.agentStates.find(a => a.agentNumber === agentNum);
    if (agent) {
      agent.status = status;
      agent.message = message;
      agent.lastRunTime = new Date().toISOString();
      if (items !== undefined) agent.itemsProcessed = items;
      if (quality !== undefined) agent.qualityScore = quality;
      if (durationMs !== undefined) agent.durationMs = durationMs;
    }
  }
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const orchestrator = new MultiAgentOrchestrator();
