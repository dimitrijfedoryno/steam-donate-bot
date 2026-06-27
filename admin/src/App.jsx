import { useState, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import DonationHistory from './components/DonationHistory';
import Statistics from './components/Statistics';
import Accounts from './components/Accounts';
import Console from './components/Console';
import TradeOffers from './components/TradeOffers';
import AlertSettings from './components/AlertSettings';
import Update from './components/Update';
import DonationGoal from './components/DonationGoal';
import Leaderboard from './components/Leaderboard';

function AppRoutes() {
  const navigate = useNavigate();
  const prevTs = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const routes = ['/', '/history', '/statistics', '/alert', '/accounts', '/console', '/trades', '/goal', '/leaderboard'];
        const idx = parseInt(e.key) - 1;
        if (routes[idx]) navigate(routes[idx]);
      }
    };
    window.addEventListener('keydown', handleKey);

    const audio = new Audio('/sounds/notification.mp3');
    audio.preload = 'auto';
    audioRef.current = audio;

    const checkAlert = async () => {
      try {
        const res = await fetch('/api/alert');
        const data = await res.json();
        if (data && data.timestamp && data.timestamp !== prevTs.current) {
          if (prevTs.current !== null) {
            audio.play().catch(() => {});
          }
          prevTs.current = data.timestamp;
        }
      } catch {}
    };
    checkAlert();
    const interval = setInterval(checkAlert, 3000);

    return () => {
      window.removeEventListener('keydown', handleKey);
      clearInterval(interval);
    };
  }, [navigate]);

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/history" element={<DonationHistory />} />
      <Route path="/statistics" element={<Statistics />} />
      <Route path="/accounts" element={<Accounts />} />
      <Route path="/alert" element={<AlertSettings />} />
      <Route path="/console" element={<Console />} />
      <Route path="/trades" element={<TradeOffers />} />
      <Route path="/live" element={<AlertSettings />} />
      <Route path="/alert-settings" element={<AlertSettings />} />
      <Route path="/goal" element={<DonationGoal />} />
      <Route path="/leaderboard" element={<Leaderboard />} />
      <Route path="/update" element={<Update />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (window.innerWidth < 768) setCollapsed(true);
    const handleResize = () => setCollapsed(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <HashRouter>
      <div className="flex h-screen overflow-hidden bg-dark-900">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        <main className={`flex-1 overflow-y-auto transition-all duration-300 ${collapsed ? 'ml-16' : 'ml-64'}`}>
          <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
            <AppRoutes />
          </div>
        </main>
      </div>
    </HashRouter>
  );
}
