'use client';

import { LayoutDashboard, Users, Activity, Settings, HelpCircle, FileText } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { icon: Activity, label: 'Analysis', href: '/' },
    { icon: Users, label: 'Patients', href: '/patients' },
    { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
    { icon: FileText, label: 'Reports', href: '/reports' },
  ];

  return (
    <aside className="w-16 lg:w-64 flex-shrink-0 bg-surface border-r border-border flex flex-col transition-all duration-300">
      {/* Brand */}
      <div className="h-14 border-b border-border flex items-center justify-center lg:justify-start lg:px-4 flex-shrink-0 bg-white">
        <div className="flex items-center gap-2">
          <div className="relative w-8 h-8 rounded overflow-hidden">
            <Image src="/logo.png" alt="ECGenius Logo" fill className="object-cover" sizes="32px" />
          </div>
          <span className="font-bold text-text-primary tracking-tight hidden lg:block">
            ECG<span className="text-primary">enius</span>
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 flex flex-col gap-1 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
                ${isActive 
                  ? 'bg-white border border-border shadow-sm text-primary font-medium' 
                  : 'text-text-secondary hover:bg-white/50 hover:text-text-primary'
                }
              `}
              title={item.label}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-primary' : 'text-text-tertiary'}`} />
              <span className="text-sm hidden lg:block">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="p-2 border-t border-border mt-auto">
        <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-text-secondary hover:bg-white/50 transition-colors w-full" title="Settings">
          <Settings className="w-5 h-5 flex-shrink-0 text-text-tertiary" />
          <span className="text-sm hidden lg:block">Settings</span>
        </button>
        <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-text-secondary hover:bg-white/50 transition-colors w-full" title="Help">
          <HelpCircle className="w-5 h-5 flex-shrink-0 text-text-tertiary" />
          <span className="text-sm hidden lg:block">Help & Support</span>
        </button>
      </div>
    </aside>
  );
}
