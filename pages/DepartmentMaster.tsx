
import React, { useState } from 'react';
import { Department } from '../types';

interface Props {
  departments: Department[];
  onUpdate: (departments: Department[]) => void;
}

const DepartmentMaster: React.FC<Props> = ({ departments, onUpdate }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleAdd = () => {
    if (!newDeptName.trim()) return;
    const newDept: Department = {
      id: `dep-${Date.now()}`,
      department_name: newDeptName,
      active: true
    };
    onUpdate([...departments, newDept]);
    setNewDeptName('');
    setIsAdding(false);
  };

  const toggleStatus = (id: string) => {
    onUpdate(departments.map(d => d.id === id ? { ...d, active: !d.active } : d));
  };

  const startEdit = (dept: Department) => {
    setEditingId(dept.id);
    setEditName(dept.department_name);
  };

  const saveEdit = () => {
    onUpdate(departments.map(d => d.id === editingId ? { ...d, department_name: editName } : d));
    setEditingId(null);
  };

  const inputClass = "flex-1 rounded-lg border-slate-300 text-slate-900 text-sm p-2.5 border bg-white focus:ring-2 focus:ring-indigo-600 outline-none placeholder-slate-400 font-semibold shadow-sm";

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Department Master</h1>
          <p className="text-slate-600 text-sm mt-1 font-bold">Manage corporate departments for internal logging.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-black flex items-center gap-2 shadow-lg hover:bg-indigo-700 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
          Add Department
        </button>
      </header>

      {isAdding && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xl flex items-center gap-4 animate-in slide-in-from-top duration-200">
          <input 
            type="text" 
            placeholder="Department Name (e.g. Sales, Marketing)" 
            value={newDeptName}
            onChange={(e) => setNewDeptName(e.target.value)}
            className={inputClass}
          />
          <button onClick={handleAdd} className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-black shadow-md hover:bg-indigo-700 transition-all">Save</button>
          <button onClick={() => setIsAdding(false)} className="px-4 py-2.5 text-sm font-black text-slate-600 hover:text-slate-900 uppercase tracking-widest text-[10px]">Cancel</button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-y-auto max-h-[600px]">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-100">
              <tr className="border-b border-slate-200">
                <th className="px-6 py-4 font-black text-slate-900 uppercase text-[10px] tracking-wider">ID Ref</th>
                <th className="px-6 py-4 font-black text-slate-900 uppercase text-[10px] tracking-wider">Department Name</th>
                <th className="px-6 py-4 font-black text-slate-900 uppercase text-[10px] tracking-wider">Status</th>
                <th className="px-6 py-4 font-black text-slate-900 uppercase text-[10px] tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {departments.map(dept => (
                <tr key={dept.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-mono text-[10px] text-slate-500 font-bold">{dept.id}</td>
                  <td className="px-6 py-4">
                    {editingId === dept.id ? (
                      <input 
                        type="text" 
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={saveEdit}
                        autoFocus
                        className="text-sm border-slate-300 rounded-lg p-2 border bg-white text-slate-900 w-full max-w-xs font-bold"
                      />
                    ) : (
                      <span className={`text-sm font-black ${!dept.active ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                        {dept.department_name}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 rounded text-[10px] font-black uppercase tracking-tight ${
                      dept.active ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {dept.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-6">
                      <button 
                        onClick={() => startEdit(dept)}
                        className="text-[10px] font-black uppercase text-indigo-700 hover:text-indigo-900 tracking-widest"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => toggleStatus(dept.id)}
                        className={`text-[10px] font-black uppercase tracking-widest ${dept.active ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800'}`}
                      >
                        {dept.active ? 'Deactivate' : 'Activate'}
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
