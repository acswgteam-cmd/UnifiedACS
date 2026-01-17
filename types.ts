
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

export interface InternalDesign {
  id: string;
  task_name: string;
  department_id: string;
  requester_name: string;
  deadline: string;
  brief: string;
  status: InternalStatus;
  created_at?: string;
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

export interface AppState {
  designers: Designer[];
  departments: Department[];
  projects: Project[];
  leads: Lead[];
  internalDesigns: InternalDesign[]; // Entitas Baru
  artworkLogs: ArtworkLog[];
}
