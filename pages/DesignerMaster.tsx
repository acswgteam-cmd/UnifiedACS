
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

  const inputClass = "w-full p-2 text-xs font-bold border border-slate-300 rounded mb-2 focus:ring-2 focus:ring-indigo-500 outline-none";

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Designer Registry</h1>
          <p className="text-slate-600 text-sm mt-1 font-medium">Manage creative team members.</p>
        </div>
        <button onClick={() => setIsAdding(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-black uppercase shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
          Add Designer
        </button>
      </header>

      {isAdding && (
        <form onSubmit={handleAdd} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xl animate-in slide-in-from-top duration-200">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">New Team Member</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <input 
              type="text" required placeholder="Name (e.g. JOHN)" className="p-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500"
              value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
            />
            <input 
              type="text" required placeholder="Role (e.g. Visualizer)" className="p-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500"
              value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})}
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-slate-500 font-bold text-xs uppercase">Cancel</button>
            <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs uppercase shadow-md hover:bg-indigo-700">Save Member</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6">
        {designers.map(d => (
          <div key={d.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md flex flex-col h-full relative group">
            
            {/* Status Indicator */}
            <div className={`absolute top-4 right-4 w-2 h-2 rounded-full ${d.active ? 'bg-emerald-500' : 'bg-red-300'}`}></div>

            <div className="mb-4">
              <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center text-xl font-black mb-3">
                {d.name.charAt(0)}
              </div>
              
              {editingId === d.id ? (
                <div className="space-y-1">
                  <input 
                    value={editData.name} 
                    onChange={(e) => setEditData({...editData, name: e.target.value})}
                    className={inputClass}
                    placeholder="Name"
                  />
                  <input 
                    value={editData.role} 
                    onChange={(e) => setEditData({...editData, role: e.target.value})}
                    className={inputClass}
                    placeholder="Role"
                  />
                </div>
              ) : (
                <div>
                  <h3 className={`font-black text-lg text-slate-900 uppercase truncate ${!d.active ? 'opacity-50 line-through decoration-red-500' : ''}`}>{d.name}</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{d.role}</p>
                </div>
              )}
            </div>

            <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
              {editingId === d.id ? (
                <>
                  <button onClick={saveEdit} className="flex-1 py-1.5 bg-indigo-600 text-white text-[10px] font-black uppercase rounded hover:bg-indigo-700">Save</button>
                  <button onClick={cancelEdit} className="flex-1 py-1.5 bg-slate-200 text-slate-600 text-[10px] font-black uppercase rounded hover:bg-slate-300">Cancel</button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => startEdit(d)}
                    className="flex-1 py-1.5 bg-slate-50 text-slate-600 hover:bg-slate-100 text-[10px] font-black uppercase rounded border border-slate-200 transition-colors"
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => toggleStatus(d)}
                    className={`flex-1 py-1.5 rounded text-[10px] font-black uppercase transition-colors ${d.active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                  >
                    {d.active ? 'Deactivate' : 'Activate'}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DesignerMaster;
