import { LayoutDashboard, TrendingUp, AlertTriangle, Activity } from 'lucide-react';

export default function DashboardPage() {
  const stats = [
    { label: 'Total Scans (30d)', value: '1,284', icon: Activity, color: 'text-primary' },
    { label: 'Abnormal Findings', value: '142', icon: AlertTriangle, color: 'text-red-500' },
    { label: 'Processing Time', value: '1.2s', icon: TrendingUp, color: 'text-green-500' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      <header className="h-14 border-b border-border bg-white flex items-center px-6 flex-shrink-0">
        <h1 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <LayoutDashboard className="w-4 h-4 text-primary" />
          Analytics Dashboard
        </h1>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-white border border-border rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{stat.label}</h3>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div className="text-3xl font-bold text-text-primary tracking-tight">
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white border border-border rounded-xl p-6 shadow-sm min-h-[400px] flex items-center justify-center">
            <div className="text-center">
              <Activity className="w-12 h-12 text-border mx-auto mb-3" />
              <p className="text-text-secondary font-medium">Chart Visualization Requires Backend Connection</p>
              <p className="text-sm text-text-tertiary mt-1">Connect the PostgreSQL database to view historical scan distributions.</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
