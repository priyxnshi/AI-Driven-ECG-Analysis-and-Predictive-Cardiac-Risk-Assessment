import { LayoutDashboard, Users, Activity, Settings, HelpCircle, FileText, LogOut, User } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Sidebar() {
  const pathname = usePathname();
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const userObj = JSON.parse(userStr);
        setUserName(userObj.username);
        setUserRole(userObj.role);
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
  };

  const navItems = userRole === 'patient' 
    ? [
        { icon: Activity, label: 'Upload ECG', href: '/' },
        { icon: FileText, label: 'My History', href: '/reports' },
      ]
    : [
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
      <div className="p-2 border-t border-border mt-auto space-y-1">
        {userName && (
          <div className="px-3 py-2 text-xs border border-border bg-white rounded-lg flex items-center gap-2 hidden lg:flex shadow-sm">
            <User className="w-4 h-4 text-text-tertiary" />
            <div className="min-w-0">
              <p className="font-semibold text-text-primary truncate">{userName.toUpperCase()}</p>
              <p className="text-[9px] text-text-tertiary uppercase font-mono">{userRole}</p>
            </div>
          </div>
        )}
        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors w-full cursor-pointer" 
          title="Sign Out"
        >
          <LogOut className="w-5 h-5 flex-shrink-0 text-red-500" />
          <span className="text-sm font-medium hidden lg:block">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

