'use client';

import { useEffect, useState } from 'react';
import { Users, Search, Filter, AlertTriangle, ArrowLeft, Heart, Clock, Download, FileText } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

interface Patient {
  id: number;
  referenceId: string;
  name: string;
  age: number;
  sex: string;
  createdAt: string;
}

interface TimelineItem {
  recordId: string;
  filename: string;
  date: string;
  status: string;
  severity: string;
  heartRate: number | null;
  summary: string | null;
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const token = localStorage.getItem('token');
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        
        const response = await fetch(`${apiBase}/api/patients`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch patient records.');
        }

        const data = await response.json();
        setPatients(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'An error occurred fetching patient data.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPatients();
  }, []);

  const handleSelectPatient = async (patient: Patient) => {
    setSelectedPatient(patient);
    setIsTimelineLoading(true);
    setTimeline([]);

    try {
      const token = localStorage.getItem('token');
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      
      const response = await fetch(`${apiBase}/api/patients/${patient.referenceId}/timeline`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load patient timeline data.');
      }

      const data = await response.json();
      setTimeline(data.timeline);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setIsTimelineLoading(false);
    }
  };

  const handleBackToList = () => {
    setSelectedPatient(null);
    setTimeline([]);
  };

  const handleDownloadPDF = (recordId: string, patientRef: string) => {
    const token = localStorage.getItem('token');
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    window.open(`${apiBase}/api/ecg/report/pdf/${recordId}?token=${token}`, '_blank');
    
    // Fallback: standard fetch attachment trigger
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
  };

  // Filter patients based on query
  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.referenceId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="text-sm font-medium text-text-secondary">Loading patient records...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      <header className="h-14 border-b border-border bg-white flex items-center px-6 flex-shrink-0">
        <h1 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          {selectedPatient ? (
            <button onClick={handleBackToList} className="mr-1 p-1 hover:bg-surface rounded transition-colors" title="Back to Directory">
              <ArrowLeft className="w-4 h-4 text-text-secondary" />
            </button>
          ) : (
            <Users className="w-4 h-4 text-primary" />
          )}
          {selectedPatient ? `Patient Longitudinal Summary — ${selectedPatient.name}` : 'Patient Directory'}
        </h1>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* PATIENT HISTORY DETAIL VIEW */}
          {selectedPatient ? (
            <div className="space-y-6">
              {/* Patient details card */}
              <div className="bg-white border border-border rounded-xl p-5 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider block">Patient ID</span>
                  <span className="font-mono text-sm font-medium text-text-primary">{selectedPatient.referenceId}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider block">Full Name</span>
                  <span className="text-sm font-medium text-text-primary">{selectedPatient.name}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider block">Age</span>
                  <span className="text-sm font-medium text-text-primary">{selectedPatient.age} Years</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider block">Biological Sex</span>
                  <span className="text-sm font-medium text-text-primary">{selectedPatient.sex}</span>
                </div>
              </div>

              {/* Heart rate trends chart */}
              {timeline.length > 0 && (
                <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
                  <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-4">
                    Clinical Heart Rate Telemetry Trend (BPM)
                  </h3>
                  <div style={{ width: '100%', height: 200 }}>
                    <ResponsiveContainer>
                      <LineChart
                        data={[...timeline].reverse().map((t, idx) => ({
                          index: idx + 1,
                          date: new Date(t.date).toLocaleDateString(),
                          rate: t.heartRate || 0
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="date" stroke="#8A9098" fontSize={9} />
                        <YAxis stroke="#8A9098" fontSize={9} domain={['dataMin - 10', 'dataMax + 10']} />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="rate"
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Patient timeline table list */}
              <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-border bg-surface/50">
                  <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Historical ECG Telemetry Records
                  </h3>
                </div>
                {isTimelineLoading ? (
                  <div className="p-10 text-center text-text-tertiary text-sm">
                    Loading telemetry timeline...
                  </div>
                ) : timeline.length === 0 ? (
                  <div className="p-10 text-center text-text-tertiary text-sm">
                    No telemetry records uploaded for this patient.
                  </div>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-surface text-text-tertiary text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-3 font-medium">Record ID</th>
                        <th className="px-6 py-3 font-medium">Filename</th>
                        <th className="px-6 py-3 font-medium">Date Analyzed</th>
                        <th className="px-6 py-3 font-medium">Heart Rate</th>
                        <th className="px-6 py-3 font-medium">Severity</th>
                        <th className="px-6 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {timeline.map((item) => (
                        <tr key={item.recordId} className="hover:bg-surface/30 transition-colors">
                          <td className="px-6 py-4 font-mono text-xs text-text-secondary">{item.recordId}</td>
                          <td className="px-6 py-4 font-medium text-text-primary">{item.filename}</td>
                          <td className="px-6 py-4 text-text-secondary">
                            {new Date(item.date).toLocaleString()}
                          </td>
                          <td className="px-6 py-4">
                            {item.heartRate ? (
                              <div className="flex items-center gap-1">
                                <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />
                                <span>{item.heartRate} BPM</span>
                              </div>
                            ) : '--'}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                              item.severity === 'normal' ? 'bg-green-100 text-green-700' :
                              item.severity === 'abnormal' ? 'bg-red-100 text-red-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {item.severity}
                            </span>
                          </td>
                          <td className="px-6 py-4 flex justify-end gap-2">
                            <button
                              onClick={() => handleDownloadPDF(item.recordId, selectedPatient.referenceId)}
                              className="p-1.5 text-text-tertiary hover:text-primary transition-colors bg-white border border-border rounded shadow-sm cursor-pointer" 
                              title="Download Report PDF"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : (
            /* PATIENTS DIRECTORY TABLE VIEW */
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="relative w-72">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                  <input 
                    type="text" 
                    placeholder="Search by name or ID..." 
                    className="w-full h-9 pl-9 pr-3 text-sm border border-border rounded-lg focus:outline-none focus:border-primary"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

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
                      <th className="px-6 py-3 font-medium">Patient ID</th>
                      <th className="px-6 py-3 font-medium">Name</th>
                      <th className="px-6 py-3 font-medium">Age</th>
                      <th className="px-6 py-3 font-medium">Biological Sex</th>
                      <th className="px-6 py-3 font-medium">Registered Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredPatients.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-text-tertiary">
                          No patients matched the query.
                        </td>
                      </tr>
                    ) : (
                      filteredPatients.map((pt) => (
                        <tr 
                          key={pt.id} 
                          className="hover:bg-surface/50 transition-colors cursor-pointer"
                          onClick={() => handleSelectPatient(pt)}
                        >
                          <td className="px-6 py-4 font-mono text-xs text-text-secondary">{pt.referenceId}</td>
                          <td className="px-6 py-4 font-medium text-text-primary">{pt.name}</td>
                          <td className="px-6 py-4 text-text-secondary">{pt.age}</td>
                          <td className="px-6 py-4 text-text-secondary">{pt.sex}</td>
                          <td className="px-6 py-4 text-text-secondary">
                            {new Date(pt.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
