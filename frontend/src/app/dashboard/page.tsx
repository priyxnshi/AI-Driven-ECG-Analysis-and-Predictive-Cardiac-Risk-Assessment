'use client';

import { useEffect, useState } from 'react';
import { LayoutDashboard, TrendingUp, AlertTriangle, Activity, Clock, CheckCircle } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

interface StatsData {
  totalECGs: number;
  pendingAnalyses: number;
  completedAnalyses: number;
  criticalCases: number;
  recentUploads: {
    id: string;
    filename: string;
    status: string;
    createdAt: string;
    patientName: string;
  }[];
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444'];

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  const [ptbxlMetrics, setPtbxlMetrics] = useState<any>(null);
  const [ptbxlLoading, setPtbxlLoading] = useState(false);
  const [ptbxlError, setPtbxlError] = useState('');
  const [imageToken, setImageToken] = useState(Date.now());

  const fetchPtbxlMetrics = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiBase}/api/ptbxl/metrics`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setPtbxlMetrics(data);
      }
    } catch (err) {
      console.error('Failed to fetch PTB-XL metrics:', err);
    }
  };

  const handleRunPtbxlEvaluation = async () => {
    setPtbxlLoading(true);
    setPtbxlError('');
    try {
      const token = localStorage.getItem('token');
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiBase}/api/ptbxl/evaluate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Evaluation request failed.');
      }
      const data = await response.json();
      setPtbxlMetrics(data);
      setImageToken(Date.now());
    } catch (err: any) {
      setPtbxlError(err.message || 'An error occurred during PTB-XL evaluation.');
    } finally {
      setPtbxlLoading(false);
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('token');
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        
        const response = await fetch(`${apiBase}/api/dashboard/stats`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch dashboard statistics.');
        }

        const data = await response.json();
        setStats(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'An error occurred fetching dashboard data.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
    fetchPtbxlMetrics();
  }, []);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="text-sm font-medium text-text-secondary">Loading statistics...</span>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background text-foreground p-6">
        <div className="max-w-md text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-text-primary">Failed to Load Dashboard</h2>
          <p className="text-sm text-text-secondary">{error || 'Unable to connect to service.'}</p>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Uploaded ECGs', value: stats.totalECGs, icon: Activity, color: 'text-primary', bg: 'bg-primary/5' },
    { label: 'Pending Queue', value: stats.pendingAnalyses, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/5' },
    { label: 'Completed Analyses', value: stats.completedAnalyses, icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/5' },
    { label: 'Critical Cases Detected', value: stats.criticalCases, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/5' },
  ];

  // Prepare chart data
  const statusData = [
    { name: 'Completed', value: stats.completedAnalyses },
    { name: 'Pending', value: stats.pendingAnalyses },
  ];

  const breakdownData = [
    { name: 'Normal', count: Math.max(0, stats.completedAnalyses - stats.criticalCases) },
    { name: 'Critical/Abnormal', count: stats.criticalCases },
  ];

  return (
    <div className="flex-1 flex flex-col bg-background">
      <header className="h-14 border-b border-border bg-white flex items-center px-6 flex-shrink-0">
        <h1 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <LayoutDashboard className="w-4 h-4 text-primary" />
          Doctor Portal Dashboard
        </h1>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {statCards.map((card) => (
              <div key={card.label} className="bg-white border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{card.label}</span>
                  <div className={`p-2 rounded-lg ${card.bg}`}>
                    <card.icon className={`w-4 h-4 ${card.color}`} />
                  </div>
                </div>
                <div className="text-2xl font-bold text-text-primary tracking-tight">
                  {card.value}
                </div>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Status Chart */}
            <div className="bg-white border border-border rounded-xl p-5 shadow-sm flex flex-col h-[320px]">
              <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-4">
                Analysis Processing Breakdown
              </h2>
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusData}>
                    <XAxis dataKey="name" stroke="#8A9098" fontSize={10} />
                    <YAxis stroke="#8A9098" fontSize={10} />
                    <Tooltip cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }} />
                    <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]}>
                      <Cell fill="#10b981" />
                      <Cell fill="#f59e0b" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Severity Chart */}
            <div className="bg-white border border-border rounded-xl p-5 shadow-sm flex flex-col h-[320px]">
              <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-4">
                Diagnostic Severity Split
              </h2>
              <div className="flex-1 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={breakdownData}
                      dataKey="count"
                      nameKey="name"
                      cx="55%"
                      cy="50%"
                      outerRadius={70}
                      fill="#2563eb"
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Recent Uploads Table */}
          <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-border bg-surface/50">
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Recent ECG Uploads Ledger
              </h3>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-text-tertiary text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3 font-medium">Record ID</th>
                  <th className="px-6 py-3 font-medium">Filename</th>
                  <th className="px-6 py-3 font-medium">Patient</th>
                  <th className="px-6 py-3 font-medium">Upload Date</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stats.recentUploads.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-text-tertiary">
                      No records uploaded yet.
                    </td>
                  </tr>
                ) : (
                  stats.recentUploads.map((rec) => (
                    <tr key={rec.id} className="hover:bg-surface/30 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-text-secondary">{rec.id}</td>
                      <td className="px-6 py-4 font-medium text-text-primary">{rec.filename}</td>
                      <td className="px-6 py-4 text-text-secondary">{rec.patientName}</td>
                      <td className="px-6 py-4 text-text-secondary">
                        {new Date(rec.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                          rec.status === 'complete' ? 'bg-green-100 text-green-700' :
                          rec.status === 'failed' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {rec.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* PTB-XL External Dataset Evaluation Card */}
          <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border bg-surface/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  PTB-XL External Test Set Evaluation
                </h3>
                <p className="text-xs text-text-tertiary mt-1">
                  Validate the trained CNN-LSTM network against the PhysioNet PTB-XL ECG database (v1.0.3)
                </p>
              </div>
              <button
                onClick={handleRunPtbxlEvaluation}
                disabled={ptbxlLoading}
                className="px-4 py-2 text-xs font-semibold text-white rounded-lg bg-primary hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center gap-2 self-start sm:self-auto"
              >
                {ptbxlLoading ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Running Evaluation...
                  </>
                ) : (
                  'Run PTB-XL Evaluation'
                )}
              </button>
            </div>

            <div className="p-6 space-y-6">
              {ptbxlError && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <span>{ptbxlError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Description & Overview */}
                <div className="md:col-span-2 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-surface rounded-lg border border-border/50">
                      <div className="text-xs text-text-tertiary uppercase font-medium">Dataset Overall Accuracy</div>
                      <div className="text-xl font-bold text-text-primary mt-1">
                        {ptbxlMetrics?.overallAccuracy !== null && ptbxlMetrics?.overallAccuracy !== undefined
                          ? `${(ptbxlMetrics.overallAccuracy * 100).toFixed(1)}%`
                          : 'Not Evaluated'}
                      </div>
                    </div>
                    <div className="p-4 bg-surface rounded-lg border border-border/50">
                      <div className="text-xs text-text-tertiary uppercase font-medium">Evaluated Samples</div>
                      <div className="text-xl font-bold text-text-primary mt-1">
                        {ptbxlMetrics?.totalTestRecords || 0} Records (50 Heartbeats)
                      </div>
                    </div>
                  </div>

                  {/* Class-wise Metrics Table */}
                  {ptbxlMetrics?.perClassMetrics && Object.keys(ptbxlMetrics.perClassMetrics).length > 0 ? (
                    <div className="border border-border rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface text-text-tertiary font-semibold uppercase tracking-wider border-b border-border">
                          <tr>
                            <th className="px-4 py-2.5">Diagnostic Class</th>
                            <th className="px-4 py-2.5 text-right">Precision</th>
                            <th className="px-4 py-2.5 text-right">Recall</th>
                            <th className="px-4 py-2.5 text-right">F1-Score</th>
                            <th className="px-4 py-2.5 text-right">Support</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {Object.entries(ptbxlMetrics.perClassMetrics).map(([code, c]: [string, any]) => (
                            <tr key={code} className="hover:bg-surface/20">
                              <td className="px-4 py-3 font-semibold text-text-primary">{code} ({c.className})</td>
                              <td className="px-4 py-3 text-right font-mono text-text-secondary">{(c.precision * 100).toFixed(1)}%</td>
                              <td className="px-4 py-3 text-right font-mono text-text-secondary">{(c.recall * 100).toFixed(1)}%</td>
                              <td className="px-4 py-3 text-right font-mono text-text-secondary">{(c.f1Score * 100).toFixed(1)}%</td>
                              <td className="px-4 py-3 text-right font-mono text-text-tertiary">{c.support}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-10 border border-dashed border-border rounded-lg text-center text-text-tertiary">
                      Click the button above to run model evaluation on PTB-XL database.
                    </div>
                  )}
                </div>

                {/* Confusion Matrix Section */}
                <div className="bg-surface rounded-lg border border-border p-4 flex flex-col justify-between">
                  <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3 text-center">
                    Confusion Matrix Visualization
                  </div>
                  {ptbxlMetrics?.overallAccuracy !== null && ptbxlMetrics?.overallAccuracy !== undefined ? (
                    <div className="flex-1 flex items-center justify-center bg-white rounded border border-border p-2 min-h-[220px]">
                      <img
                        src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/ptbxl/confusion-matrix?t=${imageToken}`}
                        alt="PTB-XL Confusion Matrix"
                        className="max-w-full max-h-[220px] object-contain rounded"
                      />
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-border/80 rounded bg-white p-6 text-center text-text-tertiary min-h-[220px]">
                      <Activity className="w-8 h-8 text-border/80 mb-2" />
                      <span className="text-xs">No confusion matrix generated.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Domain Shift Explanation Alert */}
              <div className="p-4 rounded-lg border border-blue-100 bg-blue-50/50 flex gap-3 text-xs text-blue-800 leading-relaxed">
                <AlertTriangle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold block mb-0.5 text-blue-900">Clinical AI & Domain Shift Insight:</strong>
                  While this CNN-LSTM model registers <span className="font-semibold text-blue-950">98.81% Test Accuracy</span> on the standard MIT-BIH database, testing on the external <span className="font-semibold text-blue-950">PTB-XL</span> dataset shows significant drop in accuracy (~28.0%). This is a well-documented medical machine learning phenomenon known as <strong>domain shift</strong>. It stems from variations in hardware, sampling filters (100 Hz vs 360 Hz), lead geometry (MLII vs standard Lead II), and clinical patient profiles across institutions. Deploying such algorithms clinically highlights the absolute necessity of multi-centric validation and fine-tuning.
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
