
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

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase">Designer Registry</h1>
          <p className="text-slate-600 text-sm">Manage team members.</p>
        </div>
        <button onClick={() => setIsAdding(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold">Add Designer</button>
      </header>

      {isAdding && (
        <form onSubmit={handleAdd} className="bg-white p-6 rounded-xl border border-slate-200 shadow-xl">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <input 
              type="text" required placeholder="Name" className="p-2 border rounded"
              value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
            />
            <input 
              type="text" required placeholder="Role" className="p-2 border rounded"
              value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-slate-500">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded">Save</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {designers.map(d => (
          <div key={d.id} className="bg-white p-4 rounded-xl border shadow-sm">
            <h3 className="font-bold text-slate-900">{d.name}</h3>
            <p className="text-xs text-slate-500 uppercase font-bold">{d.role}</p>
            <button 
              onClick={() => toggleStatus(d)}
              className={`mt-4 text-[10px] font-bold uppercase ${d.active ? 'text-red-500' : 'text-green-600'}`}
            >
              {d.active ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DesignerMaster;
