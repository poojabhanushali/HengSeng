import React, { useState, useEffect } from 'react';
import { SocialPost, ExchangeCode, SentimentDirection } from '../types';
import {
  MessageSquareQuote,
  Search,
  ExternalLink,
  ThumbsUp,
  MessageCircle,
  Share2,
  Eye,
  Filter,
} from 'lucide-react';
import { TranslatedText } from './TranslatedText';
import { apiJson } from '../lib/api';

export const SocialSentimentView: React.FC = () => {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('ALL');
  const [selectedSentiment, setSelectedSentiment] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPosts() {
      setLoading(true);
      try {
        const data = await apiJson('/api/v1/social/posts');
        setPosts(data.posts || []);
      } catch (err) {
        console.error('Failed to load social posts:', err);
      } finally {
        setLoading(false);
      }
    }
    loadPosts();
  }, []);

  const filteredPosts = posts.filter(post => {
    const matchPlat = selectedPlatform === 'ALL' || post.platform === selectedPlatform;
    let matchSent = true;
    if (selectedSentiment === 'BULLISH') matchSent = post.sentimentScore > 20;
    else if (selectedSentiment === 'BEARISH') matchSent = post.sentimentScore < -20;
    else if (selectedSentiment === 'NEUTRAL') matchSent = post.sentimentScore >= -20 && post.sentimentScore <= 20;

    const matchSearch =
      post.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.ticker.toLowerCase().includes(searchTerm.toLowerCase());

    return matchPlat && matchSent && matchSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Social Sentiment Intelligence Explorer
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Multilingual discussion stream across LIHKG, Telegram, Naver Finance, and Daum Finance over the latest 10-day window.
          </p>
        </div>
      </div>

      {/* Platform & Filter Toolbar */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Platform tabs */}
          <div className="flex flex-wrap items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {['ALL', 'LIHKG', 'Telegram', 'Naver Finance', 'Daum Finance', 'Futu/Moomoo'].map(plat => (
              <button
                key={plat}
                onClick={() => setSelectedPlatform(plat)}
                className={`px-2 py-1 text-[10px] sm:text-xs font-medium rounded-md transition-colors shrink-0 ${
                  selectedPlatform === plat
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {plat === 'ALL' ? 'All Sources' : plat}
              </button>
            ))}
          </div>

          {/* Sentiment tabs */}
          <div className="flex flex-wrap items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'BULLISH', label: 'Bullish' },
              { id: 'NEUTRAL', label: 'Neutral' },
              { id: 'BEARISH', label: 'Bearish' },
            ].map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedSentiment(s.id)}
                className={`px-2 py-1 text-[10px] sm:text-xs font-medium rounded-md transition-colors shrink-0 ${
                  selectedSentiment === s.id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search input */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search discussions by text keyword, author, or ticker..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full text-xs bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Post Stream Cards */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading social discussions...</div>
        ) : filteredPosts.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">No discussions match selected filters.</div>
        ) : (
          filteredPosts.map(post => {
            const isPos = post.sentimentScore > 20;
            const isNeg = post.sentimentScore < -20;

            return (
              <div
                key={post.id}
                className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3"
              >
                {/* Post Top Row */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {post.ticker}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {post.platform}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500">@{post.author}</span>
                    <span className="text-slate-400">·</span>
                    <span className="font-mono text-slate-400 text-[11px]">
                      {post.publishedAt.split('T')[0]} (UTC)
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`font-mono text-xs font-bold tabular-nums ${
                        isPos ? 'text-emerald-500' : isNeg ? 'text-red-500' : 'text-slate-400'
                      }`}
                    >
                      {post.sentimentScore > 0 ? `+${post.sentimentScore}` : post.sentimentScore} ({post.sentimentLabel})
                    </span>
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-400 hover:text-emerald-500 transition-colors"
                      title="Open Original Discussion"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* Text Body */}
                <TranslatedText
                  original={post.text}
                  translation={post.textEn}
                  originalLang={post.originalLanguage}
                  className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans"
                />

                {/* Extracted Phrases & Position */}
                {post.extractedPhrases && post.extractedPhrases.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                    <span className="text-slate-400 font-medium">Domain Lexicon Hits:</span>
                    {post.extractedPhrases.map((phrase, i) => (
                      <span
                        key={i}
                        className="font-mono font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded"
                      >
                        "{phrase}"
                      </span>
                    ))}
                    {post.expressedPosition && (
                      <span className="ml-auto font-mono text-[11px] text-slate-500">
                        Signal: <span className="font-semibold text-slate-700 dark:text-slate-300">{post.expressedPosition}</span>
                      </span>
                    )}
                  </div>
                )}

                {/* Engagement Metrics Bottom Strip */}
                <div className="flex items-center gap-6 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 font-mono">
                  <div className="flex items-center gap-1.5">
                    <ThumbsUp className="w-3 h-3 text-slate-400" />
                    <span>{post.likes}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MessageCircle className="w-3 h-3 text-slate-400" />
                    <span>{post.comments}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Share2 className="w-3 h-3 text-slate-400" />
                    <span>{post.shares}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Eye className="w-3 h-3 text-slate-400" />
                    <span>{post.views.toLocaleString()}</span>
                  </div>
                  <div className="ml-auto text-slate-400">
                    Engagement Log-Weight: <span className="font-bold text-slate-700 dark:text-slate-300">{post.engagementScore}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
