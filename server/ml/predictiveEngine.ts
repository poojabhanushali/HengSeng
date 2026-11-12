import { BacktestPoint, ModelPerformance, NewsArticle, PredictionDetail, PriceBar, SentimentDirection, SocialPost } from '../../src/types';
import { marketRepo } from '../data/marketData';
import { socialRepo, summarizePosts } from '../data/socialScraper';
import { newsRepo, summarizeNewsArticles } from '../data/newsEngine';

export interface EngineeredFeatureRow {
  date: string;
  close: number;
  return1d: number;
  return3d: number;
  sma5Ratio: number;
  rsi14: number;
  rsiPeriod: number;
  macd: number;
  volatility: number;
  socialSentiment: number;
  engagementWeightedSentiment: number;
  socialMentionsGrowth: number;
  newsSentiment: number;
  newsRelevanceWeighted: number;
  newsSocialDisagreement: number;
  pivotDistance: number;
  // Target: Next period price n+1
  targetNextClose: number;
}

// Build a single feature row for bar i without lookahead leakage.
// Sentiment/news features for bar i are derived ONLY from records published at or before bar i,
// so no record dated after the observation can influence its features.
function buildFeatureRow(
  bars: PriceBar[],
  posts: SocialPost[],
  news: NewsArticle[],
  i: number
): EngineeredFeatureRow | null {
  if (i < 2 || i >= bars.length) return null;

  const prev2 = bars[i - 2];
  const prev1 = bars[i - 1];
  const curr = bars[i];
  const next = i + 1 < bars.length ? bars[i + 1] : null;

  const return1d = (curr.close - prev1.close) / prev1.close;
  const return3d = (curr.close - prev2.close) / prev2.close;
  const sma5 = curr.sma5 || curr.close;
  const sma5Ratio = (curr.close - sma5) / sma5;
  const rsiPeriod = curr.rsiPeriod || 14;
  const rsi14 = (curr.rsi14 || 50) / 100;
  const macd = curr.macd || 0;
  const volatility = Math.abs(return1d) * 1.5;

  // Strict as-of join: only records published on or before this bar are visible.
  const barTime = Date.parse(curr.timestamp);
  const postsUpTo = posts.filter(p => Date.parse(p.publishedAt) <= barTime);
  const newsUpTo = news.filter(n => Date.parse(n.publishedAt) <= barTime);
  const socialSlice = summarizePosts(postsUpTo);
  const newsSlice = summarizeNewsArticles(newsUpTo);

  const socSent = socialSlice.avgSentiment / 100;
  const engWeighted = socialSlice.engagementWeightedSentiment / 100;
  const socGrowth = return1d > 0 ? 0.15 : -0.10;
  const nwsSent = newsSlice.avgNewsSentiment / 100;
  const nwsRel = newsSlice.relevanceWeightedSentiment / 100;
  const disagreement = Math.abs(socSent - nwsSent);
  const pivot = (curr.high + curr.low + curr.close) / 3;
  const pivotDistance = (curr.close - pivot) / curr.close;

  return {
    date: curr.timestamp,
    close: curr.close,
    return1d,
    return3d,
    sma5Ratio,
    rsi14,
    rsiPeriod,
    macd,
    volatility,
    socialSentiment: socSent,
    engagementWeightedSentiment: engWeighted,
    socialMentionsGrowth: socGrowth,
    newsSentiment: nwsSent,
    newsRelevanceWeighted: nwsRel,
    newsSocialDisagreement: disagreement,
    pivotDistance,
    targetNextClose: next ? next.close : Number.NaN,
  };
}

// Build chronological training matrix plus the feature row for the most recent bar.
// Training rows require a realised next-period target; the current row intentionally
// has no target so the deployed n+1 forecast uses today's features, not yesterday's.
export function buildFeatureDataset(ticker: string): {
  features: EngineeredFeatureRow[];
  currentBar: PriceBar;
  currentFeatureRow: EngineeredFeatureRow | null;
} {
  const bars = marketRepo.getBars(ticker);
  const posts = socialRepo.getAllPosts({ ticker });
  const news = newsRepo.getAllNews({ ticker });

  const rows: EngineeredFeatureRow[] = [];
  for (let i = 2; i < bars.length; i++) {
    const row = buildFeatureRow(bars, posts, news, i);
    if (row && Number.isFinite(row.targetNextClose)) rows.push(row);
  }

  return {
    features: rows,
    currentBar: bars[bars.length - 1],
    currentFeatureRow: buildFeatureRow(bars, posts, news, bars.length - 1),
  };
}

// Ridge Regression with L2 Regularization
class RidgeRegressionModel {
  private weights: number[] = [];
  private means: number[] = [];
  private stds: number[] = [];
  private yMean = 0;
  private yStd = 1;
  private bias = 0;
  private lambda = 0.1;

  public fit(X: number[][], y: number[]) {
    const n = X.length;
    if (n === 0) return;
    const p = X[0].length;

    // Normalize features
    this.means = new Array(p).fill(0);
    this.stds = new Array(p).fill(0);

    for (let j = 0; j < p; j++) {
      let sum = 0;
      for (let i = 0; i < n; i++) sum += X[i][j];
      this.means[j] = sum / n;

      let varSum = 0;
      for (let i = 0; i < n; i++) varSum += Math.pow(X[i][j] - this.means[j], 2);
      this.stds[j] = Math.max(0.01, Math.sqrt(varSum / n));
    }

    // Standardize targets to prevent gradient explosion on large price scales (e.g. KRW)
    let ySum = 0;
    for (let i = 0; i < n; i++) ySum += y[i];
    this.yMean = ySum / n;

    let yVarSum = 0;
    for (let i = 0; i < n; i++) yVarSum += Math.pow(y[i] - this.yMean, 2);
    this.yStd = Math.max(0.01, Math.sqrt(yVarSum / n));

    const normX = X.map(row => row.map((val, j) => (val - this.means[j]) / (this.stds[j] || 1)));
    const normY = y.map(val => (val - this.yMean) / (this.yStd || 1));

    const w = new Array(p).fill(0);
    let b = 0;
    const lr = 0.02;
    const epochs = 100;

    for (let ep = 0; ep < epochs; ep++) {
      for (let i = 0; i < n; i++) {
        let pred = b;
        for (let j = 0; j < p; j++) pred += normX[i][j] * w[j];
        const err = pred - normY[i];

        b -= lr * (err / n);
        for (let j = 0; j < p; j++) {
          w[j] -= lr * (err * normX[i][j] + this.lambda * w[j]) / n;
        }
      }
    }

    this.weights = w;
    this.bias = b;
  }

  public predict(x: number[]): number {
    let normPred = this.bias;
    for (let j = 0; j < x.length; j++) {
      const normXj = (x[j] - (this.means[j] || 0)) / (this.stds[j] || 1);
      normPred += (this.weights[j] || 0) * normXj;
    }
    return normPred * this.yStd + this.yMean;
  }

  // Standardized coefficient magnitudes normalized to sum to 1 (features are z-scored,
  // so |w| is directly comparable across inputs).
  public getCoefficientImportance(): number[] {
    const abs = this.weights.map(w => Math.abs(w || 0));
    const total = abs.reduce((a, b) => a + b, 0);
    if (total <= 0) return abs.map(() => 0);
    return abs.map(v => v / total);
  }
}

// Model Evaluation and Walk-Forward Validation Engine
export class PredictiveModelingEngine {
  public evaluateModelsForTicker(ticker: string) {
    const { features, currentBar, currentFeatureRow } = buildFeatureDataset(ticker);
    const bars = marketRepo.getBars(ticker);

    // If dataset too small
    if (features.length < 4) {
      return {
        championModel: 'Persistence Baseline',
        models: [] as ModelPerformance[],
        backtestPoints: [] as BacktestPoint[],
        featureImportances: [] as { feature: string; importance: number }[],
        predictedNextPrice: currentBar.close,
        predictedChangePct: 0,
      };
    }

    // Chronological Walk-Forward Validation
    // For t = 3 to features.length - 1:
    // Train on 0..t-1, test on t
    const oosActuals: number[] = [];
    const oosBaseCloses: number[] = [];
    const oosPersistence: number[] = [];
    const oosSMA: number[] = [];
    const oosRidge: number[] = [];
    const oosEnsemble: number[] = [];
    const backtestPoints: BacktestPoint[] = [];

    const featureToVector = (r: EngineeredFeatureRow) => [
      r.close,
      r.return1d,
      r.return3d,
      r.sma5Ratio,
      r.rsi14,
      r.volatility,
      r.socialSentiment,
      r.engagementWeightedSentiment,
      r.newsSentiment,
      r.newsSocialDisagreement,
      r.pivotDistance,
    ];

    for (let t = 2; t < features.length; t++) {
      const trainSet = features.slice(0, t);
      const testSample = features[t];

      const X_train = trainSet.map(featureToVector);
      // Train on price change delta to ensure stationarity across different asset price bases
      const y_train = trainSet.map(r => r.targetNextClose - r.close);
      const x_test = featureToVector(testSample);
      const y_actual = testSample.targetNextClose;

      // 1. Persistence Baseline: target = current close
      const predPersistence = testSample.close;

      // 2. SMA-5 Baseline: target = avg of last 3 closes
      const recentCloses = trainSet.slice(-3).map(r => r.close);
      const predSMA = recentCloses.reduce((a, b) => a + b, 0) / recentCloses.length;

      // 3. Ridge Regression with max daily circuit breaker bounds (8%)
      const maxDelta = testSample.close * 0.08;
      const ridge = new RidgeRegressionModel();
      ridge.fit(X_train, y_train);
      const rawRidgeDelta = ridge.predict(x_test);
      const boundedRidgeDelta = Math.max(-maxDelta, Math.min(maxDelta, isNaN(rawRidgeDelta) ? 0 : rawRidgeDelta));
      const predRidge = Number((testSample.close + boundedRidgeDelta).toFixed(2));

      // 4. Multi-Factor Quant Ensemble (Blend of Ridge + Sentiment Drift)
      // Must use the same engagement/relevance-weighted alpha as the deployed forecast.
      const sentimentAlpha = (testSample.engagementWeightedSentiment * 0.6 + testSample.newsRelevanceWeighted * 0.4) * (testSample.close * 0.015);
      const ensembleDelta = boundedRidgeDelta * 0.6 + sentimentAlpha * 0.4;
      const boundedEnsembleDelta = Math.max(-maxDelta, Math.min(maxDelta, ensembleDelta));
      const predEnsemble = Number((testSample.close + boundedEnsembleDelta).toFixed(2));

      oosActuals.push(y_actual);
      oosBaseCloses.push(testSample.close);
      oosPersistence.push(predPersistence);
      oosSMA.push(predSMA);
      oosRidge.push(predRidge);
      oosEnsemble.push(predEnsemble);

      const actualDir = y_actual >= testSample.close;
      const predDir = predEnsemble >= testSample.close;

      backtestPoints.push({
        date: testSample.date.split('T')[0],
        actualPrice: y_actual,
        predictedPrice: predEnsemble,
        directionMatch: actualDir === predDir,
        absoluteError: Number(Math.abs(y_actual - predEnsemble).toFixed(2)),
        sentimentScore: Number((testSample.socialSentiment * 100).toFixed(0)),
      });
    }

    // Compute metrics
    const computeMetrics = (preds: number[], name: string, desc: string, isChampion = false): ModelPerformance => {
      const n = oosActuals.length;
      let maeSum = 0;
      let rmseSum = 0;
      let mapeSum = 0;
      let dirMatches = 0;
      let ssRes = 0;
      let ssTot = 0;
      const yMean = oosActuals.reduce((a, b) => a + b, 0) / n;

      for (let i = 0; i < n; i++) {
        const act = oosActuals[i];
        const pred = preds[i];
        const err = pred - act;
        maeSum += Math.abs(err);
        rmseSum += err * err;
        mapeSum += Math.abs(err / act);

        const baseClose = oosBaseCloses[i];
        const actualDir = act >= baseClose;
        const predDir = pred >= baseClose;
        if (actualDir === predDir) dirMatches++;

        ssRes += err * err;
        ssTot += Math.pow(act - yMean, 2);
      }

      const mae = Number((maeSum / n).toFixed(2));
      const rmse = Number(Math.sqrt(rmseSum / n).toFixed(2));
      const mape = Number(((mapeSum / n) * 100).toFixed(2));
      const directionalAccuracy = Number(((dirMatches / n) * 100).toFixed(1));
      const r2Score = ssTot > 0 ? Number((1 - (ssRes / ssTot)).toFixed(3)) : 0;

      // Persistence baseline MAE
      const pMae = oosActuals.reduce((sum, act, i) => sum + Math.abs(oosPersistence[i] - act), 0) / n;
      const baselineImprovement = Number((((pMae - mae) / pMae) * 100).toFixed(1));

      return {
        modelName: name,
        description: desc,
        mae,
        rmse,
        mape,
        directionalAccuracy,
        r2Score,
        baselineImprovement,
        sampleCount: n,
        lastTrained: new Date().toISOString(),
        isChampion,
      };
    };

    const modelPerformances: ModelPerformance[] = [
      computeMetrics(oosEnsemble, 'Multi-Factor Quant Sentiment Ensemble', 'Blended Ridge + Sentiment Multi-Factor Momentum Regressor', true),
      computeMetrics(oosRidge, 'Linear / Ridge Regression (L2)', 'L2 Regularized Linear Model with Engineered Technicals & Lexicon Weights', false),
      computeMetrics(oosSMA, 'Historical 3-Day Moving Average', 'Baseline Moving Average Smoothing', false),
      computeMetrics(oosPersistence, 'Naive Persistence Baseline', 'Baseline Forecast (Next Price = Current Observed Price)', false),
    ];

    // Train on all rows to generate the NEXT-PERIOD forecast (n+1).
    // Same target definition as the validated folds (price delta) so the deployed model
    // is the model that was actually measured out-of-sample.
    const allX = features.map(featureToVector);
    const allY = features.map(r => r.targetNextClose - r.close);
    const finalModel = new RidgeRegressionModel();
    finalModel.fit(allX, allY);

    const latestRow = currentFeatureRow || features[features.length - 1];
    const latestVec = featureToVector(latestRow);
    const rawDelta = finalModel.predict(latestVec);

    // Apply sentiment alpha factor using the same as-of-bar features and weights as the validated ensemble.
    const socialSummary = socialRepo.getSentimentSummary(ticker);
    const newsSummary = newsRepo.getNewsSentimentSummary(ticker);
    const sentimentAlpha = (latestRow.engagementWeightedSentiment * 0.6 + latestRow.newsRelevanceWeighted * 0.4) * (currentBar.close * 0.015);

    // Bound the model-implied move to the same ±8% session circuit breaker used in validation
    const maxDelta = currentBar.close * 0.08;
    const boundedDelta = Math.max(-maxDelta, Math.min(maxDelta, isNaN(rawDelta) ? 0 : rawDelta));
    const ensembleDelta = boundedDelta * 0.6 + sentimentAlpha * 0.4;
    const boundedEnsembleDelta = Math.max(-maxDelta, Math.min(maxDelta, ensembleDelta));
    const finalPredictedPrice = Number((currentBar.close + boundedEnsembleDelta).toFixed(2));
    const predictedChange = Number((finalPredictedPrice - currentBar.close).toFixed(2));
    const predictedChangePercent = Number(((predictedChange / currentBar.close) * 100).toFixed(2));

    let direction: SentimentDirection = 'Neutral';
    if (predictedChangePercent >= 1.5) direction = 'Strong Bullish';
    else if (predictedChangePercent >= 0.3) direction = 'Bullish';
    else if (predictedChangePercent <= -1.5) direction = 'Strong Bearish';
    else if (predictedChangePercent <= -0.3) direction = 'Bearish';

    // 95% Confidence Interval based on the deployed production model's RMSE
    const productionModel = modelPerformances[0];
    const marginOfError = Number((productionModel.rmse * 1.96).toFixed(2));

    // Model-derived global feature contribution: |standardized ridge coefficient| of the
    // production model, grouped into the same factor families shown in the UI and
    // re-normalized so the displayed shares sum to 100%.
    const coeffImportance = finalModel.getCoefficientImportance();
    const groupShares = (indices: number[]) =>
      Number(indices.reduce((s, idx) => s + (coeffImportance[idx] || 0), 0).toFixed(4));

    const featureImportance: {
      feature: string;
      importance: number;
      value: string | number;
      impact: 'Positive' | 'Negative' | 'Neutral';
    }[] = [
      {
        feature: 'Engagement-Weighted Social Sentiment',
        importance: groupShares([6, 7]),
        value: `${socialSummary.engagementWeightedSentiment > 0 ? '+' : ''}${socialSummary.engagementWeightedSentiment}`,
        impact: socialSummary.engagementWeightedSentiment > 10 ? 'Positive' : socialSummary.engagementWeightedSentiment < -10 ? 'Negative' : 'Neutral',
      },
      {
        feature: 'Relevance-Weighted News Sentiment',
        importance: groupShares([8]),
        value: `${newsSummary.relevanceWeightedSentiment > 0 ? '+' : ''}${newsSummary.relevanceWeightedSentiment}`,
        impact: newsSummary.relevanceWeightedSentiment > 10 ? 'Positive' : newsSummary.relevanceWeightedSentiment < -10 ? 'Negative' : 'Neutral',
      },
      {
        feature: `${currentBar.rsiPeriod || 14}-Period RSI Momentum`,
        importance: groupShares([4]),
        value: currentBar.rsi14 !== undefined ? `${currentBar.rsi14}` : 'N/A',
        impact: currentBar.rsi14 !== undefined
          ? (currentBar.rsi14 > 60 ? 'Positive' : currentBar.rsi14 < 40 ? 'Negative' : 'Neutral')
          : 'Neutral',
      },
      {
        feature: '5-Day Moving Average Spread',
        importance: groupShares([3]),
        value: `${currentBar.sma5 ? (((currentBar.close - currentBar.sma5) / currentBar.sma5) * 100).toFixed(2) : '0.00'}%`,
        impact: currentBar.sma5 && currentBar.close > currentBar.sma5 ? 'Positive' : 'Negative',
      },
      {
        feature: 'News vs Social Sentiment Disagreement',
        importance: groupShares([9]),
        value: `${Math.abs(socialSummary.avgSentiment - newsSummary.avgNewsSentiment).toFixed(1)} pts`,
        impact: 'Neutral',
      },
      {
        feature: 'Pivot Point Mean Reversion Distance',
        importance: groupShares([10]),
        value: `${(((currentBar.close - ((currentBar.high + currentBar.low + currentBar.close) / 3)) / currentBar.close) * 100).toFixed(2)}%`,
        impact: 'Neutral',
      },
      {
        feature: 'Price & Return Momentum (1D/3D)',
        importance: groupShares([0, 1, 2, 5]),
        value: `${(latestRow.return1d * 100).toFixed(2)}% (1D)`,
        impact: latestRow.return1d > 0.005 ? 'Positive' : latestRow.return1d < -0.005 ? 'Negative' : 'Neutral',
      },
    ];

    // Target the next trading day after the last observed bar, not after wall-clock time.
    const nextTradingDay = new Date(currentBar.timestamp);
    do {
      nextTradingDay.setDate(nextTradingDay.getDate() + 1);
    } while (nextTradingDay.getDay() === 0 || nextTradingDay.getDay() === 6);

    const assetInfo = marketRepo.getAsset(ticker);

    const predictionDetail: PredictionDetail = {
      ticker,
      assetName: assetInfo ? assetInfo.name : ticker,
      exchange: assetInfo ? assetInfo.exchange : 'HKEX',
      currentPrice: currentBar.close,
      predictedPrice: finalPredictedPrice,
      predictedChange,
      predictedChangePercent,
      direction,
      predictionHorizon: 'Next Trading Day (n+1)',
      generatedAt: new Date().toISOString(),
      targetDate: nextTradingDay.toISOString().split('T')[0],
      modelName: productionModel.modelName,
      confidenceInterval: {
        lower95: Number(Math.max(0, finalPredictedPrice - marginOfError).toFixed(2)),
        upper95: Number((finalPredictedPrice + marginOfError).toFixed(2)),
      },
      featureImportance,
      validationMetrics: {
        mae: productionModel.mae,
        rmse: productionModel.rmse,
        directionalAccuracy: productionModel.directionalAccuracy,
        baselineImprovementPercent: productionModel.baselineImprovement,
      },
    };

    return {
      predictionDetail,
      modelPerformances,
      backtestPoints,
      featureImportances: featureImportance.map(f => ({ feature: f.feature, importance: f.importance })),
    };
  }
}

export const mlEngine = new PredictiveModelingEngine();
