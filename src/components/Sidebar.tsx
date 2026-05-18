import { Activity, Users, ClipboardList, ShieldCheck, Bell } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export default function Sidebar() {
  const location = useLocation();

  const navItems = [
    { icon: Activity, label: 'Dashboard', path: '/' },
    { icon: Users, label: 'Athletes', path: '/athletes' },
    { icon: ClipboardList, label: 'Lab Reports', path: '/reports' },
    { icon: ShieldCheck, label: 'Anti-Doping', path: '/anti-doping' },
    { icon: Bell, label: 'Alerts', path: '/alerts' },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 hidden md:flex flex-col border-r border-slate-800 h-screen sticky top-0">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">SM</div>
        <span className="font-bold text-white tracking-tight text-lg">SPORTS MED</span>
      </div>
      
      <nav className="flex-1 px-4 space-y-1 mt-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 group ${
                isActive 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20' 
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'}`} />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-2 py-3 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors group">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium group-hover:ring-2 group-hover:ring-blue-500 transition-all">SS</div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">Dr. Sarah Smith</p>
            <p className="text-xs text-slate-500 truncate">Chief Medical Officer</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
