
export enum WorkContext {
  PROJECT = 'PROJECT',
  LEAD = 'LEAD',
  INTERNAL = 'INTERNAL'
}

export type InternalStatus = 'NEW' | 'ON HOLD' | 'ON PROGRESS' | 'ON REVIEW' | 'DONE';

export interface Designer {
  id: string;
  name: string;
  role: string;
  active: boolean;
}

export interface Department {
  id: string;
  department_name: string;
  active: boolean;
}

export interface Project {
  id: string;
  project_name: string;
  start_date: string;
  end_date: string;
  locations: string[];
  pic_designer_id: string;
  support_designer_ids: string[];
  project_type: string;
  notes?: string;
  status: 'ON HOLD' | 'ON PROGRESS' | 'DONE';
}

export interface ChecklistTemplate {
  id: string;
  name: string;
}

export interface ChecklistTemplateItem {
  id: string;
  template_id: string;
  task_name: string;
  size: string;
  notes: string;
}

export interface ProjectChecklist {
  id: string;
  project_id: string;
  task_name: string;
  size: string;
  quantity: number;
  notes: string;
  status: 'NONE' | 'ON PROGRESS' | 'DONE';
  source_template_id?: string | null; // To track if this item came from a template
  created_at?: string;
}

export interface Lead {
  id: string;
  lead_name: string;
  requester: string;
  order_date: string;
  deadline: string;
  lead_grade: string;
  brief: string;
  drive_link: string;
  status: 'ON PROGRESS' | 'DONE' | 'CANCEL';
}

export interface StatusHistoryEntry {
  status: InternalStatus;
  timestamp: string;
}

export type ChangelogChangeType =
  | 'TASK_CREATED'
  | 'STATUS_CHANGE'
  | 'DEADLINE_CHANGE'
  | 'DEPT_CHANGE'
  | 'BRIEF_CHANGE'
  | 'NOTE';

export interface ChangelogEntry {
  id: string;
  internal_design_id: string;
  change_type: ChangelogChangeType;
  old_value?: string | null;
  new_value?: string | null;
  note?: string | null;
  note_title?: string | null;           // judul catatan (opsional)
  note_deadline?: string | null;        // deadline catatan (opsional)
  note_status?: 'OPEN' | 'DONE' | null; // status catatan
  reference_link?: string | null;
  image_url?: string | null;
  pic_designer_id?: string | null;
  changed_by?: string;
  created_at: string;
}

export interface InternalDesign {
  id: string;
  task_name: string;
  department_id: string;
  requester_name: string;
  deadline: string | null;   // nullable — task tanpa deadline diizinkan
  brief: string;
  status: InternalStatus;
  created_at?: string;
  status_history?: StatusHistoryEntry[];
}

// Sub-catatan per task — bisa punya deadline sendiri (opsional)
export interface TaskNote {
  id: string;
  internal_design_id: string;
  title: string;
  content?: string | null;
  deadline?: string | null;
  status: 'OPEN' | 'DONE';
  reference_link?: string | null;
  image_url?: string | null;
  pic_designer_id?: string | null;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface ArtworkLog {
  id: string;
  work_context: WorkContext;
  project_id?: string | null;
  lead_id?: string | null;
  internal_design_id?: string | null; // Referensi ke InternalDesign spesifik
  department_id?: string | null;
  artwork_name: string;
  artwork_type: string; // 2D Design, 3D Design, Video
  start_date: string;
  end_date: string;
  pic_designer_id: string;
  revision_count: number;
  approval_required: boolean;
  notes?: string;
}

export interface ProjectSurvey {
  id: string;
  project_id: string;
  rating_speed: number;
  rating_quality: number;
  rating_accuracy: number;
  rating_coord_internal: number;
  rating_coord_client: number;
  rating_problem_solving: number;
  rating_agility: number;
  rating_impact: number;
  evaluator_name?: string;
  notes?: string;
  created_at: string;
  status?: 'SUBMITTED' | 'CLARIFICATION_REQUESTED';
  clarification_notes?: string;
}

export interface DesignerEvaluation {
  id: string;
  project_id: string;
  designer_id: string;
  evaluator_name?: string;
  kategori?: string;
  job_title?: string;
  inisiatif?: number;
  disiplin?: number;
  penyelesaian_tugas?: number;
  attitude?: number;
  komunikasi?: number;
  respon_masukan?: number;
  masukan_pengembangan?: string;
  created_at?: string;
}

export interface AppState {
  designers: Designer[];
  departments: Department[];
  projects: Project[];
  leads: Lead[];
  internalDesigns: InternalDesign[];
  artworkLogs: ArtworkLog[];
  projectSurveys: ProjectSurvey[];
  designerEvaluations: DesignerEvaluation[];
  projectChecklists: ProjectChecklist[];
  checklistTemplates: ChecklistTemplate[];
  checklistTemplateItems: ChecklistTemplateItem[];
}
