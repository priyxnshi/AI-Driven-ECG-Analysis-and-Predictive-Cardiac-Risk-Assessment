'use client';

import { useEffect, useState } from 'react';
import { FileText, Download, FileJson, Table, AlertTriangle } from 'lucide-react';

interface ECGReport {
  id: string;
  filename: string;
  createdAt: string;
  status: string;
  category: string;
  severity: string;
  patientName: string;
  patientRef: string;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<ECGReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReports = async () => {
    try {
      const token = localStorage.getItem('token');
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      
      const response = await fetch(`${apiBase}/api/ecg/records`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch ECG reports.');
      }

      const data = await response.json();
      // Only show completed/ready reports
      setReports(data.filter((r: ECGReport) => r.status === 'complete'));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred fetching reports.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleDownloadReport = (recordId: string, format: 'pdf' | 'csv' | 'json', patientRef: string) => {
    const token = localStorage.getItem('token');
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    
    if (format === 'pdf') {
      window.open(`${apiBase}/api/ecg/report/pdf/${recordId}?token=${token}`, '_blank');
      
      // Secondary fallback
      fetch(`${apiBase}/api/ecg/report/pdf/${recordId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(resp => resp.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Report_${patientRef}_${recordId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
    } else if (format === 'csv') {
      fetch(`${apiBase}/api/ecg/report/csv/${recordId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(resp => resp.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Report_${patientRef}_${recordId}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
    } else {
      fetch(`${apiBase}/api/ecg/report/json/${recordId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(resp => resp.json())
      .then(json => {
        const str = JSON.stringify(json, null, 2);
        const blob = new Blob([str], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Report_${patientRef}_${recordId}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="text-sm font-medium text-text-secondary">Loading reports...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      <header className="h-14 border-b border-border bg-white flex items-center px-6 flex-shrink-0">
        <h1 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Clinical Reports Ledger
        </h1>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          
          <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface border-b border-border text-text-tertiary text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3 font-medium">Report ID</th>
                  <th className="px-6 py-3 font-medium">Patient Reference</th>
                  <th className="px-6 py-3 font-medium">Patient Name</th>
                  <th className="px-6 py-3 font-medium">Date Generated</th>
                  <th className="px-6 py-3 font-medium">Severity</th>
                  <th className="px-6 py-3 font-medium text-right">Export Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-text-tertiary">
                      No reports generated yet. Process uploads to create reports.
                    </td>
                  </tr>
                ) : (
                  reports.map((rep) => (
                    <tr key={rep.id} className="hover:bg-surface/50 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-text-secondary">{rep.id}</td>
                      <td className="px-6 py-4 font-mono text-xs text-text-secondary">{rep.patientRef}</td>
                      <td className="px-6 py-4 font-medium text-text-primary">{rep.patientName}</td>
                      <td className="px-6 py-4 text-text-secondary">
                        {new Date(rep.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                          rep.severity === 'normal' ? 'bg-green-100 text-green-700' :
                          rep.severity === 'abnormal' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {rep.severity}
                        </span>
                      </td>
                      <td className="px-6 py-4 flex justify-end gap-2">
                        <button 
                          onClick={() => handleDownloadReport(rep.id.replace('rec_', ''), 'pdf', rep.patientRef)}
                          className="p-1.5 text-text-tertiary hover:text-primary transition-colors bg-white border border-border rounded shadow-sm cursor-pointer" 
                          title="Download PDF Summary"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDownloadReport(rep.id.replace('rec_', ''), 'csv', rep.patientRef)}
                          className="p-1.5 text-text-tertiary hover:text-primary transition-colors bg-white border border-border rounded shadow-sm cursor-pointer" 
                          title="Export CSV Metrics"
                        >
                          <Table className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDownloadReport(rep.id.replace('rec_', ''), 'json', rep.patientRef)}
                          className="p-1.5 text-text-tertiary hover:text-primary transition-colors bg-white border border-border rounded shadow-sm cursor-pointer" 
                          title="Export JSON Structure"
                        >
                          <FileJson className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
        </div>
      </div>
    </div>
  );
}
