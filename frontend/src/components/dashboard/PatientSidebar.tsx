'use client';

import type { PatientMetadata } from '@/lib/types';
import MonoValue from '@/components/ui/MonoValue';
import { User, Calendar, Clock, Radio, Cpu, Hash } from 'lucide-react';

interface PatientSidebarProps {
  patient: PatientMetadata | null;
  isLoading?: boolean;
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="skeleton w-4 h-4 rounded" />
      <div className="flex-1">
        <div className="skeleton h-2.5 w-16 rounded mb-1" />
        <div className="skeleton h-3 w-24 rounded" />
      </div>
    </div>
  );
}

interface MetaRowProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  mono?: boolean;
}

function MetaRow({ icon, label, value, mono }: MetaRowProps) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="text-text-tertiary mt-0.5 flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider mb-0.5">
          {label}
        </p>
        {mono ? (
          <MonoValue value={value} size="sm" />
        ) : (
          <p className="text-sm font-medium text-text-primary truncate">{String(value)}</p>
        )}
      </div>
    </div>
  );
}

export default function PatientSidebar({ patient, isLoading }: PatientSidebarProps) {
  if (isLoading || !patient) {
    return (
      <div className="w-64 border-r border-border bg-white p-4 flex-shrink-0">
        <div className="skeleton h-3 w-28 rounded mb-4" />
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="w-64 border-r border-border bg-white flex-shrink-0 overflow-y-auto">
      {/* Section title */}
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
          Patient Metadata
        </h2>
      </div>

      <div className="px-4 divide-y divide-border">
        <MetaRow
          icon={<User className="w-3.5 h-3.5" />}
          label="Patient"
          value={`${patient.name}, ${patient.age}y ${patient.sex}`}
        />
        <MetaRow
          icon={<Hash className="w-3.5 h-3.5" />}
          label="Reference ID"
          value={patient.referenceId}
          mono
        />
        <MetaRow
          icon={<Calendar className="w-3.5 h-3.5" />}
          label="Recording Date"
          value={patient.recordingDate}
        />
        <MetaRow
          icon={<Clock className="w-3.5 h-3.5" />}
          label="Duration"
          value={patient.duration}
          mono
        />
        <MetaRow
          icon={<Radio className="w-3.5 h-3.5" />}
          label="Lead Config"
          value={patient.leadConfiguration}
        />
        <MetaRow
          icon={<Cpu className="w-3.5 h-3.5" />}
          label="Device"
          value={patient.device}
        />
      </div>

      {/* Heart Rate highlight */}
      <div className="mx-4 mt-4 p-3 bg-surface rounded-lg border border-border">
        <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider mb-1">
          Heart Rate
        </p>
        <div className="flex items-baseline gap-1">
          <MonoValue value={patient.heartRate} size="xl" />
          <span className="text-xs text-text-tertiary font-medium">BPM</span>
        </div>
      </div>
    </div>
  );
}
