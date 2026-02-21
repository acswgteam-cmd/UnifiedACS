
import React, { useMemo } from 'react';
import { AppState, ArtworkLog, WorkContext } from '../types';
import ArtworkForm from '../components/ArtworkForm';
import ArtworkTable from '../components/ArtworkTable';

interface Props {
  state: AppState;
  onAdd: (log: ArtworkLog) => void;
  onUpdate: (log: ArtworkLog) => void;
  onDelete: (id: string) => void;
}

const ArtworkLogPage: React.FC<Props> = ({ state, onAdd, onUpdate, onDelete }) => {
  const stats = useMemo(() => {
    return {
      totalArtworks: state.artworkLogs.length,
      projectArtworks: state.artworkLogs.filter(l => l.work_context === WorkContext.PROJECT).length,
      totalLeads: state.leads.length,
      activeTeam: state.designers.filter(d => d.active).length
    };
  }, [state.artworkLogs, state.designers, state.leads]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Artwork Log</h1>
          <p className="text-zinc-600 text-sm mt-1 font-medium">Centralized creative operations and production tracking.</p>
        </div>
      </header>

      {/* Updated Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Artworks" value={stats.totalArtworks} icon="🎨" color="bg-zinc-100 text-zinc-900" />
        <StatCard label="Project Artworks" value={stats.projectArtworks} icon="📁" color="bg-blue-50 text-blue-600" />
        <StatCard label="Total Leads" value={stats.totalLeads} icon="🎯" color="bg-emerald-50 text-emerald-600" />
        <StatCard label="Active Team" value={stats.activeTeam} icon="👥" color="bg-amber-50 text-amber-600" />
      </div>

      <div className="space-y-8">
        <section>
          <ArtworkForm state={state} onSubmit={onAdd} />
        </section>
        
        <section>
          <ArtworkTable state={state} onUpdate={onUpdate} onDelete={onDelete} />
        </section>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number; icon: string; color: string }> = ({ label, value, icon, color }) => (
  <div className="bg-white p-5 rounded-[20px] border border-[#EAEAEA] shadow-sm flex items-center space-x-4 transition-all hover:shadow-md">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-inner ${color}`}>
      {icon}
    </div>
    <div>
      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-zinc-900 leading-none mt-1">{value}</p>
    </div>
  </div>
);

export default ArtworkLogPage;
