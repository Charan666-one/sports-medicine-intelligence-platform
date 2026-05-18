import { Search, Bell, Menu } from 'lucide-react';

export default function Header() {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-20 backdrop-blur-md bg-white/80">
      <div className="flex items-center gap-4 flex-1">
        <button className="md:hidden p-2 hover:bg-slate-100 rounded-md">
          <Menu className="w-5 h-5" />
        </button>
        <div className="relative w-full max-w-md group">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Search athletes, reports, or test IDs..." 
            className="w-full bg-slate-100 border-transparent rounded-full py-2 pl-10 pr-4 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-1">
          <div className="px-2 py-1 bg-green-50 text-green-700 rounded text-[10px] font-bold uppercase">System Stable</div>
        </div>
        <button className="p-2 text-slate-500 hover:text-slate-900 transition-colors relative group">
          <Bell className="w-5 h-5 group-hover:shake" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        <div className="w-px h-6 bg-slate-200 mx-1"></div>
        <button className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Sign Out</button>
      </div>
    </header>
  );
}
