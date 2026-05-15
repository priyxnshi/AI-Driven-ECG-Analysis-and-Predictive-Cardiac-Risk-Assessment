import { FileText, Download, FileJson } from 'lucide-react';

export default function ReportsPage() {
  const reports = [
    { id: 'REP-2938', date: '2026-05-11', type: 'Clinical Summary', patient: 'James Wilson', status: 'Generated' },
    { id: 'REP-2937', date: '2026-05-10', type: 'Full Waveform Export', patient: 'Sarah Connor', status: 'Generated' },
    { id: 'REP-2936', date: '2026-05-09', type: 'Clinical Summary', patient: 'Michael Chang', status: 'Generated' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      <header className="h-14 border-b border-border bg-white flex items-center px-6 flex-shrink-0">
        <h1 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Clinical Reports
        </h1>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          
          <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface border-b border-border text-text-tertiary text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3 font-medium">Report ID</th>
                  <th className="px-6 py-3 font-medium">Date Generated</th>
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium">Patient</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reports.map((rep) => (
                  <tr key={rep.id} className="hover:bg-surface/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-text-secondary">{rep.id}</td>
                    <td className="px-6 py-4 text-text-secondary">{rep.date}</td>
                    <td className="px-6 py-4 font-medium text-text-primary">{rep.type}</td>
                    <td className="px-6 py-4 text-text-secondary">{rep.patient}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-surface text-text-secondary border border-border">
                        {rep.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 flex justify-end gap-2">
                      <button className="p-1.5 text-text-tertiary hover:text-primary transition-colors bg-white border border-border rounded shadow-sm" title="Download PDF">
                        <Download className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 text-text-tertiary hover:text-primary transition-colors bg-white border border-border rounded shadow-sm" title="Download JSON/XML">
                        <FileJson className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
        </div>
      </div>
    </div>
  );
}
