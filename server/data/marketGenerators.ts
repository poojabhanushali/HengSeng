import { PriceBar } from '../../src/types';

// Helper to calculate technical indicators on PriceBar series
export function computeTechnicalIndicators(bars: PriceBar[]): PriceBar[] {
  const result = [...bars];

  for (let i = 0; i < result.length; i++) {
    if (i >= 4) {
      const slice5 = result.slice(i - 4, i + 1);
      result[i].sma5 = Number((slice5.reduce((sum, b) => sum + b.close, 0) / 5).toFixed(2));
    }
    if (i >= 9) {
      const slice10 = result.slice(i - 9, i + 1);
      result[i].sma10 = Number((slice10.reduce((sum, b) => sum + b.close, 0) / 10).toFixed(2));
    }
  }

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i < result.length; i++) {
    const change = result[i].close - result[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    if (i === 1) {
      avgGain = gain;
      avgLoss = loss;
    } else if (i <= 14) {
      avgGain += gain;
      avgLoss += loss;
    } else {
      avgGain = (avgGain * 13 + gain) / 14;
      avgLoss = (avgLoss * 13 + loss) / 14;
    }

    if (i >= 2) {
      const period = Math.min(14, i);
      const avgG = avgGain / period;
      const avgL = avgLoss / period;
      const rs = avgL === 0 ? 100 : avgG / avgL;
      result[i].rsi14 = Number((100 - (100 / (1 + rs))).toFixed(2));
      result[i].rsiPeriod = period;
      if (i === 14) {
        avgGain = avgG;
        avgLoss = avgL;
      }
    }
  }

  const ema12 = calculateEMA(result.map(b => b.close), 12);
  const ema26 = calculateEMA(result.map(b => b.close), 26);
  const macdLine = ema12.map((val, idx) => Number((val - ema26[idx]).toFixed(2)));
  const signalLine = calculateEMA(macdLine, 9);

  for (let i = 0; i < result.length; i++) {
    result[i].macd = macdLine[i];
    result[i].macdSignal = signalLine[i];
  }

  return result;
}

function calculateEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [];
  let prevEma = values[0];
  ema.push(prevEma);

  for (let i = 1; i < values.length; i++) {
    const currentEma = values[i] * k + prevEma * (1 - k);
    ema.push(Number(currentEma.toFixed(2)));
    prevEma = currentEma;
  }
  return ema;
}

export function calculatePivotLevels(bars: PriceBar[]) {
  if (bars.length === 0) return { pivot: 0, s1: 0, s2: 0, r1: 0, r2: 0, swingHigh: 0, swingLow: 0 };

  const lastBar = bars[bars.length - 1];
  const high = lastBar.high;
  const low = lastBar.low;
  const close = lastBar.close;

  const pivot = Number(((high + low + close) / 3).toFixed(2));
  const r1 = Number((2 * pivot - low).toFixed(2));
  const s1 = Number((2 * pivot - high).toFixed(2));
  const r2 = Number((pivot + (high - low)).toFixed(2));
  const s2 = Number((pivot - (high - low)).toFixed(2));

  const swingHigh = Math.max(...bars.map(b => b.high));
  const swingLow = Math.min(...bars.map(b => b.low));

  return {
    pivot,
    s1,
    s2,
    r1,
    r2,
    swingHigh: Number(swingHigh.toFixed(2)),
    swingLow: Number(swingLow.toFixed(2)),
  };
}

// Generate realistic 10-day historical daily bars for an asset
export function generateHistoricalBars(ticker: string, basePrice: number, days = 10): PriceBar[] {
  const bars: PriceBar[] = [];
  const now = new Date();

  let seed = 0;
  for (let i = 0; i < ticker.length; i++) seed += ticker.charCodeAt(i);

  function seededRandom() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  let currentClose = basePrice;
  const dateCursor = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  for (let d = 0; d < days; d++) {
    dateCursor.setDate(dateCursor.getDate() + 1);

    const dayOfWeek = dateCursor.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      continue;
    }

    const volatility = 0.018;
    const changePct = (seededRandom() - 0.48) * 2 * volatility;
    const open = Number((currentClose * (1 + (seededRandom() - 0.5) * 0.005)).toFixed(2));
    const close = Number((currentClose * (1 + changePct)).toFixed(2));
    const high = Number((Math.max(open, close) * (1 + seededRandom() * 0.012)).toFixed(2));
    const low = Number((Math.min(open, close) * (1 - seededRandom() * 0.012)).toFixed(2));
    const volume = Math.floor(1000000 + seededRandom() * 15000000);

    bars.push({
      timestamp: dateCursor.toISOString(),
      open,
      high,
      low,
      close,
      volume,
    });

    currentClose = close;
  }

  return computeTechnicalIndicators(bars);
}
