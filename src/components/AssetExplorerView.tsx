import React, { useState, useMemo } from 'react';
import { Asset, ExchangeCode, SentimentDirection } from '../types';
import {
  ArrowUpDown,
  Search,
  Download,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  Filter,
  ChevronDown,
  ChevronRight,
  Globe2,
} from 'lucide-react';
import { TranslatedText } from './TranslatedText';
import { DropdownMenu } from './DropdownMenu';

interface AssetExplorerViewProps {
  assets: Asset[];
  selectedExchange: ExchangeCode | 'ALL';
  setSelectedExchange: (ex: ExchangeCode | 'ALL') => void;
  onSelectAsset: (asset: Asset) => void;
}

type SortField =
  | 'rank'
  | 'ticker'
  | 'currentPrice'
  | 'priceChangePercent'
  | 'socialMentions'
  | 'newsMentions'
  | 'overallSentiment'
  | 'predictedChangePercent';

export const AssetExplorerView: React.FC<AssetExplorerViewProps> = ({
  assets,
  selectedExchange,
  setSelectedExchange,
  onSelectAsset,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('overallSentiment');
  const [sortAsc, setSortAsc] = useState(false);
  const [sentimentFilter, setSentimentFilter] = useState<string>('ALL');

  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      const matchEx = selectedExchange === 'ALL' || asset.exchange === selectedExchange;
      const matchSearch =
        asset.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.nameLocal.toLowerCase().includes(searchTerm.toLowerCase());

      let matchSent = true;
      if (sentimentFilter === 'BULLISH') matchSent = asset.overallSentiment > 20;
      else if (sentimentFilter === 'BEARISH') matchSent = asset.overallSentiment < -20;
      else if (sentimentFilter === 'NEUTRAL') matchSent = asset.overallSentiment >= -20 && asset.overallSentiment <= 20;

      return matchEx && matchSearch && matchSent;
    });
  }, [assets, selectedExchange, searchTerm, sentimentFilter]);

  const sortedAssets = useMemo(() => {
    const list = [...filteredAssets];
    list.sort((a, b) => {
      let valA: any = a[sortField as keyof Asset];
      let valB: any = b[sortField as keyof Asset];

      if (sortField === 'rank') {
        valA = a.overallSentiment;
        valB = b.overallSentiment;
      }

      if (valA === valB) return 0;
      if (valA === undefined) return 1;
      if (valB === undefined) return -1;

      return sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });
    return list;
  }, [filteredAssets, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Rank',
      'Ticker',
      'Asset Name',
      'Exchange',
      'Current Price',
      'Price Change %',
      'Social Mentions',
      'News Count',
      'Sentiment Score (-100 to +100)',
      'Sentiment Direction',
      'Predicted Price (n+1)',
      'Predicted Change %',
      'Prediction Direction',
      'Last Updated',
    ];

    const rows = sortedAssets.map((a, idx) => [
      idx + 1,
      a.ticker,
      `"${a.name}"`,
      a.exchange,
      a.currentPrice,
      `${a.priceChangePercent}%`,
      a.socialMentions,
      a.newsMentions,
      a.overallSentiment,
      a.sentimentDirection,
      a.predictedPrice,
      `${a.predictedChangePercent}%`,
      a.predictionDirection,
      a.lastUpdated,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `hengseng_asset_rankings_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderSentimentBadge = (direction: SentimentDirection, score: number) => {
    let color = 'text-slate-500';
    if (score >= 60) color = 'text-emerald-500 font-semibold';
    else if (score >= 20) color = 'text-emerald-600 dark:text-emerald-400';
    else if (score <= -60) color = 'text-red-500 font-semibold';
    else if (score <= -20) color = 'text-red-600 dark:text-red-400';

    return (
      <div className="flex items-center gap-1.5">
        <span className={`font-mono text-xs tabular-nums ${color}`}>
          {score > 0 ? `+${score}` : score}
        </span>
        <span className="text-slate-400 dark:text-slate-500 text-xs">·</span>
        <span className="text-xs text-slate-700 dark:text-slate-300">{direction}</span>
      </div>
    );
  };

  const fmtPrice = (asset: Asset, val: number) =>
    asset.currency === 'KRW' ? `₩${val.toLocaleString()}` : `HK$${val.toFixed(2)}`;

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Asset Intelligence & Predictive Rankings
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Standardized multi-source sentiment scores (-100 to +100) and Walk-Forward out-of-sample next-period (n+1) price forecasts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by ticker, company name, or local name..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full text-xs bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <div className="flex flex-wrap items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(['ALL', 'HKEX', 'KRX'] as const).map(ex => (
              <button
                key={ex}
                onClick={() => setSelectedExchange(ex)}
                className={`px-2 py-1 text-[10px] sm:text-xs font-medium rounded-md transition-colors shrink-0 ${
                  selectedExchange === ex
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {ex === 'ALL' ? 'All' : ex}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'BULLISH', label: 'Bullish' },
              { id: 'NEUTRAL', label: 'Neutral' },
              { id: 'BEARISH', label: 'Bearish' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setSentimentFilter(f.id)}
                className={`px-2 py-1 text-[10px] sm:text-xs font-medium rounded-md transition-colors shrink-0 ${
                  sentimentFilter === f.id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {sortedAssets.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-xs">
          No assets match current criteria.
        </div>
      ) : (
        <>
          {/* Desktop: sortable table */}
          <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-3 w-10 text-center">Rank</th>
                  <th className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white" onClick={() => handleSort('ticker')}>
                    <div className="flex items-center gap-1">
                      <span>Asset / Ticker</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-3 text-center">Exchange</th>
                  <th className="py-3 px-3 text-right cursor-pointer hover:text-slate-900 dark:hover:text-white" onClick={() => handleSort('currentPrice')}>
                    <div className="flex items-center justify-end gap-1">
                      <span>Price</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-3 text-right cursor-pointer hover:text-slate-900 dark:hover:text-white" onClick={() => handleSort('priceChangePercent')}>
                    <div className="flex items-center justify-end gap-1">
                      <span>Change (24h)</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-3 text-right cursor-pointer hover:text-slate-900 dark:hover:text-white" onClick={() => handleSort('socialMentions')}>
                    <div className="flex items-center justify-end gap-1">
                      <span>Social Vol</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white" onClick={() => handleSort('overallSentiment')}>
                    <div className="flex items-center gap-1">
                      <span>Sentiment Score</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-3 text-right cursor-pointer hover:text-slate-900 dark:hover:text-white" onClick={() => handleSort('predictedChangePercent')}>
                    <div className="flex items-center justify-end gap-1">
                      <span>Predicted (n+1)</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sortedAssets.map((asset, idx) => {
                  const isPositive = asset.priceChangePercent >= 0;
                  const isPredPositive = asset.predictedChangePercent >= 0;

                  return (
                    <tr
                      key={asset.ticker}
                      onClick={() => onSelectAsset(asset)}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-3 text-center font-mono text-slate-400 tabular-nums">
                        {idx + 1}
                      </td>

                      <td className="py-3 px-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                              {asset.ticker}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                              {asset.nameLocal}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 truncate max-w-[160px]">
                            {asset.name}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400">
                          {asset.exchange}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="font-mono font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                          {fmtPrice(asset, asset.currentPrice)}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div
                          className={`inline-flex items-center gap-0.5 font-mono tabular-nums ${
                            isPositive
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {isPositive ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          <span>
                            {isPositive ? '+' : ''}
                            {asset.priceChangePercent.toFixed(2)}%
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                          {asset.socialMentions} posts
                        </div>
                        <div className="text-[9px] text-slate-400">
                          {asset.newsMentions} news
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        {renderSentimentBadge(asset.sentimentDirection, asset.overallSentiment)}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="font-mono font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                          {fmtPrice(asset, asset.predictedPrice)}
                        </div>
                        <div
                          className={`text-[10px] font-mono tabular-nums ${
                            isPredPositive
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {isPredPositive ? '+' : ''}
                          {asset.predictedChangePercent.toFixed(2)}% ({asset.predictionDirection})
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectAsset(asset);
                          }}
                          className="p-1 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                          title="View Asset Terminal"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        <DropdownMenu
                          trigger={<ChevronDown className="w-3 h-3" />}
                          items={[
                            {
                              label: 'View Asset Terminal',
                              onClick: () => onSelectAsset(asset),
                              icon: <ExternalLink className="w-3 h-3" />,
                            },
                            {
                              label: 'Compare Assets',
                              onClick: () => console.log(`Compare ${asset.ticker}`),
                              icon: <Globe2 className="w-3 h-3" />,
                            },
                            {
                              label: 'Export Single Asset',
                              onClick: () => console.log(`Export ${asset.ticker}`),
                              icon: <Download className="w-3 h-3" />,
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked cards (no horizontal scroll) */}
          <div className="block lg:hidden space-y-3 pt-2">
            {sortedAssets.map((asset, idx) => {
              const isPositive = asset.priceChangePercent >= 0;
              const isPredPositive = asset.predictedChangePercent >= 0;

              return (
                <div
                  key={asset.ticker}
                  onClick={() => onSelectAsset(asset)}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs cursor-pointer transition-all hover:border-slate-300 dark:hover:border-slate-700"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">
                        {asset.ticker}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {asset.nameLocal}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-500">#{idx + 1}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate mb-1.5">{asset.name}</div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">Price</span>
                      <span className="font-mono font-medium text-slate-900 dark:text-slate-100">{fmtPrice(asset, asset.currentPrice)}</span>
                    </div>
                    <div className="flex items-center gap-1 justify-end">
                      <span className={`font-mono font-medium ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                        {isPositive ? '+' : ''}{asset.priceChangePercent.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">Sentiment</span>
                      <span className={`font-mono font-medium ${asset.overallSentiment > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {asset.overallSentiment > 0 ? '+' : ''}{asset.overallSentiment}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 justify-end">
                      <span className={`font-mono font-medium ${isPredPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                        {isPredPositive ? '+' : ''}{asset.predictedChangePercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[9px] text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-1">
                    <span>{asset.exchange}</span>
                    <span>{asset.socialMentions} posts · {asset.newsMentions} news</span>
                    <DropdownMenu
                      trigger={<ChevronDown className="w-3 h-3" />}
                      items={[
                        {
                          label: 'View Asset Terminal',
                          onClick: () => onSelectAsset(asset),
                          icon: <ExternalLink className="w-3 h-3" />,
                        },
                        {
                          label: 'Export Asset Data',
                          onClick: () => console.log(`Export ${asset.ticker}`),
                          icon: <Download className="w-3 h-3" />,
                        },
                      ]}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
