import React, { useState, useEffect } from 'react';
import { AgentExecutionState, IngestionJob } from '../types';
import {
  Workflow,
  Play,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Clock,
  Bug,
} from 'lucide-react';
import { DropdownMenu } from './DropdownMenu';

interface PipelineMonitorViewProps {
  isPipelineRunning: boolean;
  onTriggerPipeline: () => void;
}

export const PipelineMonitorView: React.FC<PipelineMonitorViewProps> = ({
  isPipelineRunning,
  onTriggerPipeline,
}) => {
  const [agents, setAgents] = useState<AgentExecutionState[]>([]);
  const [history, setHistory] = useState<IngestionJob[]>([]);
  const [integrityChecks, setIntegrityChecks] = useState<{ name: string; passed: boolean; detail: string }[]>([]);

  const fetchStatus = async () => {
    try {
      const [statusRes, historyRes] = await Promise.all([
        fetch('/api/v1/agents/status'),
        fetch('/api/v1/ingestion/history'),
      ]);
      if (statusRes.ok) {
        const data = await statusRes.json();
        setAgents(data.agents || []);
        setIntegrityChecks(data.integrityChecks || []);
      }
      if (historyRes.ok) {
        const hData = await historyRes.json();
        setHistory(hData.history || []);
      }
    } catch (err) {
      console.error('Failed to load agent statuses:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Autonomous Multi-Agent Orchestration Console
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time execution status for Agents 1 through 8 coordinating data ingestion, multilingual sentiment analysis, ML training, and QC audits.
          </p>
        </div>

        <button
          onClick={onTriggerPipeline}
          disabled={isPipelineRunning}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg text-white transition-all shadow-sm ${
            isPipelineRunning
              ? 'bg-emerald-700 opacity-80 cursor-wait'
              : 'bg-emerald-600 hover:bg-emerald-500 active:scale-95'
          }`}
        >
          {isPipelineRunning ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Orchestrating Agents 1–8...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Trigger Complete Pipeline Execution</span>
            </>
          )}
        </button>
      </div>

      {/* Agents 1-8 Execution Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {agents.map(agent => {
          const isRunning = agent.status === 'running';

          return (
            <div
              key={agent.agentNumber}
              className={`p-4 rounded-xl border bg-white dark:bg-slate-900 transition-all flex flex-col justify-between ${
                isRunning
                  ? 'border-emerald-500 shadow-md ring-1 ring-emerald-500'
                  : 'border-slate-200 dark:border-slate-800 shadow-xs'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    AGENT 0{agent.agentNumber}
                  </span>
                  <span
                    className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded ${
                      isRunning
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 animate-pulse'
                        : agent.status === 'failed'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                    }`}
                  >
                    {isRunning ? 'RUNNING' : agent.status === 'failed' ? 'FAILED' : 'IDLE'}
                  </span>
                </div>

                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  {agent.agentName}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                  {agent.role}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] space-y-1.5 font-mono text-slate-500">
                <div className="flex justify-between">
                  <span>Processed:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{agent.itemsProcessed} records</span>
                </div>
                <div className="flex justify-between">
                  <span>Execution:</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {agent.durationMs > 0 ? `${agent.durationMs}ms` : 'not measured'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Quality Score:</span>
                  <span className={`font-bold ${agent.qualityScore >= 100 ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {agent.qualityScore > 0 ? `${agent.qualityScore}/100` : '—'}
                  </span>
                </div>
                <div className="pt-1 text-[10px] text-slate-400 truncate" title={agent.message}>
                  {agent.message}
                </div>
              </div>

              <DropdownMenu
                trigger={<ExternalLink className="w-3 h-3" />}
                items={[
                  {
                    label: 'View Agent Details',
                    onClick: () => console.log(`Agent ${agent.agentNumber} details`),
                    icon: <Clock className="w-3 h-3" />,
                  },
                  {
                    label: 'Restart Agent',
                    onClick: () => console.log(`Restart agent ${agent.agentNumber}`),
                    disabled: agent.status === 'running',
                    icon: <RefreshCw className="w-3 h-3" />,
                  },
                  {
                    label: 'View Execution Logs',
                    onClick: () => console.log(`Agent ${agent.agentNumber} logs`),
                    icon: <Bug className="w-3 h-3" />,
                  },
                ]}
              />
            </div>
          );
        })}
      </div>

      {/* Quality Control Audit Checklist */}
      <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Agent 8 Quality Control Verification Checklist
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
          {integrityChecks.length === 0 ? (
            <div className="col-span-full py-2 text-slate-400">Loading integrity checks...</div>
          ) : (
            integrityChecks.map(check => (
              <div
                key={check.name}
                title={check.detail}
                className={`p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2 ${
                  check.passed
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {check.passed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{check.name}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Execution Run History */}
      <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3">
          Pipeline Execution Audit Log
        </h2>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-mono">
          {history.length === 0 ? (
            <div className="py-4 text-center text-slate-400">No previous runs recorded. Click "Trigger Pipeline Execution" to run.</div>
          ) : (
            history.map(job => (
              <div key={job.id} className="py-2.5 flex items-center justify-between text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{job.name}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-[11px]">{job.startTime.split('T')[1].substring(0, 8)} UTC</span>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <span>{job.recordsProcessed} items</span>
                  <span>{job.durationMs}ms</span>
                  <span className="text-emerald-500 font-semibold">{job.status.toUpperCase()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
