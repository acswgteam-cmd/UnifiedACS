
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Project } from '../types';
import { supabase } from '../lib/supabase';
import { SURVEY_FORM_SECRET } from '../App';

const SURVEY_QUESTIONS = [
  {
    id: 'rating_speed',
    label: '1. Kecepatan Delivery Output',
    options: [
      { val: 1, text: 'Lambat' },
      { val: 2, text: 'Sesuai Timeline' },
      { val: 3, text: 'Lebih Cepat dari Timeline' }
    ]
  },
  {
    id: 'rating_quality',
    label: '2. Kualitas Output Final',
    options: [
      { val: 1, text: 'Di bawah standar' },
      { val: 2, text: 'Sesuai standar' },
      { val: 3, text: 'Di atas standar' }
    ]
  },
  {
    id: 'rating_accuracy',
    label: '3. Akurasi Implementasi Brief',
    options: [
      { val: 1, text: 'Banyak mismatch' },
      { val: 2, text: 'Sesuai brief' },
      { val: 3, text: 'Melebihi ekspektasi' }
    ]
  },
  {
    id: 'rating_coord_internal',
    label: '4. Koordinasi Internal Tim',
    options: [
      { val: 1, text: 'Tidak efektif' },
      { val: 2, text: 'Cukup efektif' },
      { val: 3, text: 'Proaktif & terstruktur' }
    ]
  },
  {
    id: 'rating_coord_client',
    label: '5. Koordinasi dengan Klien',
    options: [
      { val: 1, text: 'Tidak efektif' },
      { val: 2, text: 'Cukup efektif' },
      { val: 3, text: 'Proaktif & solutif' }
    ]
  },
  {
    id: 'rating_problem_solving',
    label: '6. Problem Solving Capability',
    options: [
      { val: 1, text: 'Issue tidak terselesaikan' },
      { val: 2, text: 'Terselesaikan standar' },
      { val: 3, text: 'Solusi cepat & berdampak' }
    ]
  },
  {
    id: 'rating_agility',
    label: '7. Agility terhadap Perubahan / Revisi',
    options: [
      { val: 1, text: 'Lambat beradaptasi' },
      { val: 2, text: 'Adaptif standar' },
      { val: 3, text: 'Cepat & fleksibel' }
    ]
  }
];

const PublicProjectSurvey: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const isAuthorized = token === SURVEY_FORM_SECRET;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [surveyedProjectIds, setSurveyedProjectIds] = useState<Set<string>>(new Set());
  
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');

  // 1. Fetch Data
  useEffect(() => {
    if (!isAuthorized || !supabase) return;

    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch Projects (Only DONE or ON PROGRESS)
        const { data: projData, error: projError } = await supabase
          .from('projects')
          .select('*')
          .in('status', ['DONE', 'ON PROGRESS'])
          .order('end_date', { ascending: false });
        
        if (projError) throw projError;

        // Fetch Existing Surveys (to lock them)
        const { data: survData, error: survError } = await supabase
          .from('project_surveys')
          .select('project_id');
        
        if (survError) throw survError;

        setProjects(projData || []);
        setSurveyedProjectIds(new Set(survData?.map(s => s.project_id) || []));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isAuthorized]);

  const handleRatingChange = (questionId: string, val: number) => {
    setRatings(prev => ({ ...prev, [questionId]: val }));
  };

  const isFormValid = () => {
    // Check if all 7 questions have a value
    return SURVEY_QUESTIONS.every(q => ratings[q.id] !== undefined);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !supabase) return;
    
    setSubmitting(true);
    try {
      const payload = {
        project_id: selectedProject.id,
        rating_speed: ratings['rating_speed'],
        rating_quality: ratings['rating_quality'],
        rating_accuracy: ratings['rating_accuracy'],
        rating_coord_internal: ratings['rating_coord_internal'],
        rating_coord_client: ratings['rating_coord_client'],
        rating_problem_solving: ratings['rating_problem_solving'],
        rating_agility: ratings['rating_agility'],
        notes: notes
      };

      const { error } = await supabase.from('project_surveys').insert([payload]);

      if (error) {
        if (error.code === '23505') { // Unique violation
          alert("Survey for this project has already been submitted!");
          setSurveyedProjectIds(prev => new Set(prev).add(selectedProject.id));
          setSelectedProject(null);
        } else {
          throw error;
        }
      } else {
        setSubmitted(true);
      }
    } catch (err: any) {
      alert(`Error submitting survey: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // --- RENDERING ---

  if (!isAuthorized) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white font-bold">
      403 UNAUTHORIZED SURVEY ACCESS
    </div>
  );

  if (submitted) {
    return (
      <div className="min-h-screen bg-indigo-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 text-center animate-in zoom-in duration-300 border-t-8 border-indigo-600">
          <div className="w-20 h-20 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Thank You!</h1>
          <p className="text-slate-700 mb-8 font-medium">Your evaluation has been recorded. Your feedback helps us improve our creative delivery.</p>
          <button onClick={() => { setSubmitted(false); setSelectedProject(null); setRatings({}); setNotes(''); window.location.reload(); }} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg">Back to Projects</button>
        </div>
      </div>
    );
  }

  // --- SCREEN 1: PROJECT LIST ---
  if (!selectedProject) {
    return (
      <div className="min-h-screen bg-slate-100 py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-1.5 bg-slate-900 text-white rounded-full text-[10px] font-bold uppercase tracking-widest mb-4">Internal Team Portal</div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Project Evaluation Survey</h1>
            <p className="text-slate-500 mt-2 font-medium">Select a project below to evaluate the design team's performance.</p>
          </div>

          {loading ? (
             <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map(p => {
                const isDone = surveyedProjectIds.has(p.id);
                return (
                  <button 
                    key={p.id}
                    disabled={isDone}
                    onClick={() => setSelectedProject(p)}
                    className={`text-left relative p-6 rounded-2xl border transition-all duration-300 group flex flex-col h-full
                      ${isDone 
                        ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed grayscale' 
                        : 'bg-white border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-300 hover:-translate-y-1'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${p.status === 'DONE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                        {p.status}
                      </span>
                      {isDone && <span className="text-[9px] font-black text-slate-500 uppercase bg-slate-200 px-2 py-0.5 rounded">Evaluated</span>}
                    </div>
                    <h3 className="text-lg font-black text-slate-900 uppercase leading-tight mb-2 group-hover:text-indigo-600 transition-colors">{p.project_name}</h3>
                    <div className="mt-auto pt-4 border-t border-slate-100 w-full">
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase">
                        <span>End: {p.end_date}</span>
                        <span>{p.project_type}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
              {projects.length === 0 && (
                <div className="col-span-full text-center py-20 text-slate-400 font-bold italic">No projects available for evaluation.</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- SCREEN 2: EVALUATION FORM ---
  return (
    <div className="min-h-screen bg-slate-100 py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => setSelectedProject(null)} className="mb-6 flex items-center gap-2 text-slate-500 font-bold text-xs uppercase hover:text-indigo-600 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"/></svg>
          Back to List
        </button>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-900 p-8 text-white">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-2 block">Evaluating Project</span>
            <h1 className="text-2xl font-black uppercase tracking-tight mb-1">{selectedProject.project_name}</h1>
            <p className="text-sm font-medium opacity-80">{selectedProject.project_type} &bull; Ended {selectedProject.end_date}</p>
          </div>

          <div className="p-8 md:p-12 space-y-10">
            {SURVEY_QUESTIONS.map((q) => (
              <div key={q.id} className="animate-in slide-in-from-bottom duration-500">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4">{q.label}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {q.options.map((opt) => {
                    const isSelected = ratings[q.id] === opt.val;
                    return (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => handleRatingChange(q.id, opt.val)}
                        className={`p-4 rounded-xl border-2 text-left transition-all duration-200 flex flex-col gap-1
                          ${isSelected 
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-inner' 
                            : 'border-slate-100 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                          }
                        `}
                      >
                        <span className={`text-xl font-black ${isSelected ? 'text-indigo-600' : 'text-slate-300'}`}>{opt.val}</span>
                        <span className="text-xs font-bold uppercase leading-tight">{opt.text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="pt-4 border-t border-slate-100">
              <label className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-3 block">8. Catatan Tambahan (Opsional)</label>
              <textarea 
                rows={3}
                maxLength={200}
                placeholder="Hambatan, improvement area, ide optimasi workflow..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full p-4 rounded-xl border-2 border-slate-200 text-sm font-medium outline-none focus:border-indigo-600 focus:ring-0 transition-colors bg-slate-50 focus:bg-white"
              />
              <div className="text-right text-[10px] font-bold text-slate-400 mt-2 uppercase">{notes.length}/200 Karakter</div>
            </div>

            <button 
              type="submit" 
              disabled={submitting || !isFormValid()}
              className={`w-full py-5 rounded-2xl font-bold text-lg shadow-xl uppercase tracking-widest transition-all
                ${!isFormValid() 
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                  : 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700 hover:shadow-2xl hover:-translate-y-1'
                }
              `}
            >
              {submitting ? 'Submitting...' : 'Submit Evaluation'}
            </button>
            {!isFormValid() && (
              <p className="text-center text-xs font-bold text-red-400 uppercase">Please answer all 7 questions</p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default PublicProjectSurvey;
