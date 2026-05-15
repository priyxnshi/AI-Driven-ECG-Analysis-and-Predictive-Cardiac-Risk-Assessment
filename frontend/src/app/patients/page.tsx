import { Users, Search, Filter } from 'lucide-react';

export default function PatientsPage() {
  const mockPatients = [
    { id: 'PT-10492', name: 'Chandan V', age: 24, lastScan: '2026-05-10', status: 'Abnormal', condition: 'Normal Sinus Rhythm' },
    { id: 'PT-10493', name: 'Yash', age: 28, lastScan: '2026-05-09', status: 'Abnormal', condition: 'Atrial Fibrillation' },
    { id: 'PT-10494', name: 'Farahan ', age: 28, lastScan: '2026-05-08', status: 'Borderline', condition: 'Sinus Tachycardia' },
    { id: 'PT-10495', name: 'Priyanchi', age: 25, lastScan: '2026-05-05', status: 'Abnormal', condition: 'Atrial Flutter' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      <header className="h-14 border-b border-border bg-white flex items-center px-6 flex-shrink-0">
        <h1 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Patient Directory
        </h1>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input 
                type="text" 
                placeholder="Search by name or ID..." 
                className="w-full h-9 pl-9 pr-3 text-sm border border-border rounded-lg focus:outline-none focus:border-primary"
              />
            </div>
            <button className="flex items-center gap-2 h-9 px-3 border border-border rounded-lg text-sm text-text-secondary hover:bg-surface">
              <Filter className="w-4 h-4" />
              Filter
            </button>
          </div>

          <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface border-b border-border text-text-tertiary text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3 font-medium">Patient ID</th>
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Age</th>
                  <th className="px-6 py-3 font-medium">Last Scan</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Primary Condition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {mockPatients.map((pt) => (
                  <tr key={pt.id} className="hover:bg-surface/50 transition-colors cursor-pointer">
                    <td className="px-6 py-4 font-mono text-xs text-text-secondary">{pt.id}</td>
                    <td className="px-6 py-4 font-medium text-text-primary">{pt.name}</td>
                    <td className="px-6 py-4 text-text-secondary">{pt.age}</td>
                    <td className="px-6 py-4 text-text-secondary">{pt.lastScan}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                        pt.status === 'Normal' ? 'bg-green-100 text-green-700' :
                        pt.status === 'Abnormal' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {pt.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-text-secondary">{pt.condition}</td>
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
