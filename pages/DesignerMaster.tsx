
import React, { useState } from 'react';
import { Designer } from '../types';

interface Props {
  designers: Designer[];
  onUpdate: (designers: Designer[]) => void;
}

const DesignerMaster: React.FC<Props> = ({ designers, onUpdate }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ name: '', role: '' });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    
    const newDesigner: Designer = {
      id: `des-${Date.now()}`,
      name: formData.name,
      role: formData.role || 'Designer',
      active: true
    };
    
    onUpdate([...designers, newDesigner]);
    setFormData({ name: '', role: '' });
    setIsAdding(false);
  };

  const toggleStatus = (id: string) => {
    onUpdate(designers.map(d => d.id === id ? { ...d, active: !d.active } : d));
  };

  const labelClass = "text-[11px] font-black text-slate-900 uppercase tracking-tight mb-1.5 block";
  const inputClass = "w-full rounded-lg border-slate-300 text-slate-900 text-sm p-3 border bg-white focus:ring-2 focus:ring-indigo-600 outline-none transition-all placeholder-slate-400 font-semibold shadow-sm";

  return (
    <div className="space-y-6 flex flex-col h-full">
      <header className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Designer Registry</h1>
          <p className="text-slate-600 text-sm mt-1 font-bold">Manage team members and their availability.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-black flex items-center gap-2 shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
          Add Designer
        </button>
      </header>

      {isAdding && (
        <form onSubmit={handleAdd} className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl animate-in zoom-in duration-200 flex-shrink-0">
          <h2 className="font-black text-slate-900 mb-6 flex items-center gap-2">
            <span className="w-2 h-2 bg-indigo-600 rounded-full"></span>
            Register New Team Member
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-1">
              <label className={labelClass}>Full Name</label>
              <input 
                type="text" 
                required
                placeholder="e.g. John Doe"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Role / Title</label>
              <input 
                type="text" 
                required
                placeholder="e.g. Senior Visual Designer"
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>
          <div className="flex justify-end gap-4 pt-4 border-t border-slate-100">
            <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-2 text-sm font-black text-slate-600 hover:text-slate-900 uppercase tracking-widest text-[10px]">Cancel</button>
            <button type="submit" className="px-8 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-black shadow-lg hover:bg-indigo-700 transition-all">Save Designer</button>
          </div>
        </form>
      )}

      <div className="flex-1 overflow-y-auto min-h-0 pr-2 pb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {designers.map(d => (
            <div key={d.id} className={`bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col transition-all hover:shadow-md ${!d.active ? 'opacity-70 grayscale' : ''}`}>
              <div className="flex items-start gap-4 mb-4">
                <div className={`w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center font-black text-lg shadow-sm ${
                  d.active ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-600'
                }`}>
                  {d.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-black text-slate-900 truncate tracking-tight">{d.name}</h3>
                  <p className="text-xs text-slate-600 font-black uppercase tracking-wider truncate">{d.role}</p>
                </div>
              </div>
              
              <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  d.active ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'
                }`}>
                  {d.active ? 'Active' : 'Inactive'}
                </span>
                <button 
                  onClick={() => toggleStatus(d.id)}
                  className={`text-[10px] font-black uppercase tracking-widest ${
                    d.active ? 'text-red-500 hover:text-red-700' : 'text-indigo-700 hover:text-indigo-900'
                  }`}
                >
                  {d.active ? 'Deactivate' : 'Activate Account'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DesignerMaster;
