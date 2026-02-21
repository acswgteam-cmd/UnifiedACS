
import React, { useState } from 'react';
import { Designer } from '../types';
import { supabase } from '../lib/supabase';

interface Props {
  designers: Designer[];
  onUpdate: () => void;
}

const DesignerMaster: React.FC<Props> = ({ designers, onUpdate }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ name: '', role: '' });
  
  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ name: '', role: '' });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !supabase) return;
    
    const { error } = await supabase.from('designers').insert([{
      name: formData.name,
      role: formData.role || 'Designer',
      active: true
    }]);

    if (error) alert(error.message);
    else {
      onUpdate();
      setFormData({ name: '', role: '' });
      setIsAdding(false);
    }
  };

  const toggleStatus = async (designer: Designer) => {
    if (!supabase) return;
    const { error } = await supabase.from('designers').update({ active: !designer.active }).eq('id', designer.id);
    if (error) alert(error.message);
    else onUpdate();
  };

  const startEdit = (d: Designer) => {
    setEditingId(d.id);
    setEditData({ name: d.name, role: d.role });
  };

  const saveEdit = async () => {
    if (!supabase || !editingId) return;
    const { error } = await supabase.from('designers').update({
      name: editData.name,
      role: editData.role
    }).eq('id', editingId);

    if (error) {
      alert(error.message);
    } else {
      setEditingId(null);
      onUpdate();
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({ name: '', role: '' });
  };

  const inputClass = "w-full p-2 text-xs font-bold border border-zinc-300 rounded mb-2 focus:ring-2 focus:ring-indigo-500 outline-none";

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 uppercase tracking-tight">Designer Registry</h1>
          <p className="text-zinc-600 text-sm mt-1 font-medium">Manage creative team members.</p>
        </div>
        <button onClick={() => setIsAdding(true)} className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-xs font-bold uppercase shadow-sm border border-[#EAEAEA] hover:bg-black transition-all flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
          Add Designer
        </button>
      </header>

      {isAdding && (
        <form onSubmit={handleAdd} className="bg-white p-4 rounded-xl border border-[#EAEAEA] shadow-sm border border-[#EAEAEA] animate-in slide-in-from-top duration-200 max-w-2xl">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">New Team Member</h3>
          <div className="flex gap-3 mb-3">
            <input 
              type="text" required placeholder="Name (e.g. JOHN)" className="flex-1 p-2.5 border border-[#EAEAEA] rounded-lg text-xs font-bold outline-none focus:border-zinc-900"
              value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
            />
            <input 
              type="text" required placeholder="Role (e.g. Visualizer)" className="flex-1 p-2.5 border border-[#EAEAEA] rounded-lg text-xs font-bold outline-none focus:border-zinc-900"
              value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsAdding(false)} className="px-3 py-2 text-zinc-500 font-bold text-xs uppercase hover:bg-[#FCFCFC] rounded-lg">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-zinc-900 text-white rounded-lg font-bold text-xs uppercase shadow hover:bg-black">Save</button>
          </div>
        </form>
      )}

      {/* Minimalist Grid Layout */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {designers.map(d => (
          <div key={d.id} className="bg-white p-3 rounded-xl border border-[#EAEAEA] shadow-sm transition-all hover:border-indigo-300 hover:shadow-md group relative">
            
            {editingId === d.id ? (
              <div className="space-y-2">
                <input 
                  value={editData.name} 
                  onChange={(e) => setEditData({...editData, name: e.target.value})}
                  className="w-full text-xs font-bold p-1 border border-indigo-200 rounded bg-zinc-100"
                  placeholder="Name"
                />
                <input 
                  value={editData.role} 
                  onChange={(e) => setEditData({...editData, role: e.target.value})}
                  className="w-full text-[10px] font-bold p-1 border border-indigo-200 rounded bg-white"
                  placeholder="Role"
                />
                <div className="flex gap-1 pt-1">
                  <button onClick={saveEdit} className="flex-1 bg-zinc-900 text-white text-[9px] font-bold py-1 rounded">Save</button>
                  <button onClick={cancelEdit} className="flex-1 bg-[#F8F9FA] text-zinc-600 text-[9px] font-bold py-1 rounded">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start mb-2">
                  <div className="min-w-0 pr-2">
                    <h3 className={`text-xs font-bold text-zinc-900 uppercase truncate ${!d.active ? 'opacity-50 line-through' : ''}`}>{d.name}</h3>
                    <p className="text-[10px] text-zinc-500 font-bold truncate mt-0.5">{d.role}</p>
                  </div>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${d.active ? 'bg-emerald-500' : 'bg-red-300'}`}></div>
                </div>

                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity pt-2 border-t border-zinc-50">
                   <button 
                      onClick={() => startEdit(d)}
                      className="flex-1 text-[9px] font-bold text-zinc-400 hover:text-zinc-900 uppercase text-left"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => toggleStatus(d)}
                      className={`flex-1 text-[9px] font-bold uppercase text-right hover:underline ${d.active ? 'text-zinc-400 hover:text-red-500' : 'text-emerald-600'}`}
                    >
                      {d.active ? 'Deactivate' : 'Activate'}
                    </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DesignerMaster;
