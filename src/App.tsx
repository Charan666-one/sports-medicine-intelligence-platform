/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar.js';
import Header from './components/Header.js';
import NotificationCenter from './components/NotificationCenter.js';
import { Toaster } from 'sonner';
import Dashboard from './pages/Dashboard.js';
import Athletes from './pages/Athletes.js';
import AthleteDetail from './pages/AthleteDetail.js';
import Reports from './pages/Reports.js';
import AntiDoping from './pages/AntiDoping.js';
import Alerts from './pages/Alerts.js';
import { AnimatePresence, motion } from 'motion/react';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-50 flex">
        <Toaster position="top-right" richColors />
        <NotificationCenter />
        <Sidebar />

        <div className="flex-1 flex flex-col min-w-0">
          <Header />

          <main className="p-6 max-w-7xl mx-auto w-full">
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/" element={<PageWrapper><Dashboard /></PageWrapper>} />
                <Route path="/athletes" element={<PageWrapper><Athletes /></PageWrapper>} />
                <Route path="/athletes/:id" element={<PageWrapper><AthleteDetail /></PageWrapper>} />
                <Route path="/reports" element={<PageWrapper><Reports /></PageWrapper>} />
                <Route path="/anti-doping" element={<PageWrapper><AntiDoping /></PageWrapper>} />
                <Route path="/alerts" element={<PageWrapper><Alerts /></PageWrapper>} />
              </Routes>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </Router>
  );
}

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
}

