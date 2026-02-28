
import React, { useState } from 'react';
import { Department } from '../types';
import { supabase } from '../lib/supabase';

interface Props {
  departments: Department[];
  onUpdate: () => void;
}

const DepartmentMaster: React.FC<Props> = ({ departments, onUpdate }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleAdd = async () => {
    if (!newDeptName.trim() || !supabase) return;

    const { error } = await supabase.from('departments').insert([{
      department_name: newDeptName,
      active: true
    }]);

    if (error) {
      alert(`Gagal Simpan: ${error.message}. Cek kolom 'department_name' di database.`);
    } else {
      onUpdate();
      setNewDeptName('');
      setIsAdding(false);
    }
  };

  const toggleStatus = async (dept: Department) => {
    if (!supabase) return;
    const { error } = await supabase
      .from('departments')
      .update({ active: !dept.active })
      .eq('id', dept.id);

    if (error) alert(error.message);
    else onUpdate();
  };

  const startEdit = (dept: Department) => {
    setEditingId(dept.id);
    setEditName(dept.department_name);
  };

  const saveEdit = async () => {
    if (!supabase || !editingId) return;
    const { error } = await supabase
      .from('departments')
      .update({ department_name: editName })
      .eq('id', editingId);

    if (error) alert(error.message);
    else {
      setEditingId(null);
      onUpdate();
    }
  };

  const inputClass = "flex-1 rounded-lg border-zinc-300 text-zinc-900 text-sm p-2.5 border bg-white focus:ring-2 focus:ring-indigo-600 outline-none placeholder-slate-400 font-semibold shadow-sm";

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 uppercase tracking-tight">Department Master</h1>
          <p className="text-zinc-600 text-sm mt-1 font-bold">Manage creative units.</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm border border-[#EAEAEA]"
        >
          Add Dept
        </button>
      </header>

      {isAdding && (
        <div className="bg-white p-6 rounded-xl border border-[#EAEAEA] shadow-sm border border-[#EAEAEA] flex items-center gap-4 animate-in slide-in-from-top duration-200">
          <input
            type="text"
            placeholder="Department Name"
            value={newDeptName}
            onChange={(e) => setNewDeptName(e.target.value)}
            className={inputClass}
          />
          <button onClick={handleAdd} className="px-6 py-2.5 bg-zinc-900 text-white rounded-lg text-sm font-bold shadow-md hover:bg-black transition-all">Save</button>
          <button onClick={() => setIsAdding(false)} className="px-4 py-2.5 text-sm font-bold text-zinc-600 hover:text-zinc-900 uppercase tracking-wider text-[10px]">Cancel</button>
        </div>
      )}

      <div className="bg-white rounded-[20px] border border-[#EAEAEA] shadow-sm overflow-hidden overflow-x-auto animate-in fade-in duration-300">
        <div className="overflow-y-auto max-h-[600px]">
          <table className="w-full text-left text-xs md:text-sm border-collapse min-w-[600px] md:min-w-0">
            <thead className="sticky top-0 z-10 bg-[#F8F9FA]">
              <tr className="border-b border-[#EAEAEA]">
                <th className="px-6 py-4 font-bold text-zinc-900 uppercase text-[10px]">ID</th>
                <th className="px-6 py-4 font-bold text-zinc-900 uppercase text-[10px]">Dept Name</th>
                <th className="px-6 py-4 font-bold text-zinc-900 uppercase text-[10px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {departments.map(dept => (
                <tr key={dept.id} className="hover:bg-[#FCFCFC] transition-colors">
                  <td className="px-6 py-4 font-mono text-[10px] text-zinc-500 font-bold truncate max-w-[100px]">{dept.id}</td>
                  <td className="px-6 py-4">
                    {editingId === dept.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                        autoFocus
                        className="text-sm border-zinc-300 rounded-lg p-2 border bg-white font-bold"
                      />
                    ) : (
                      <span className={`text-sm font-bold ${!dept.active ? 'text-zinc-400 line-through' : 'text-zinc-900'}`}>
                        {dept.department_name}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-6">
                      <button onClick={() => startEdit(dept)} className="text-[10px] font-bold uppercase text-zinc-800 tracking-wider">Edit</button>
                      <button onClick={() => toggleStatus(dept)} className={`text-[10px] font-bold uppercase tracking-wider ${dept.active ? 'text-red-500' : 'text-green-600'}`}>
                        {dept.active ? 'Off' : 'On'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DepartmentMaster;
