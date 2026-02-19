
import { WorkContext, AppState, ArtworkLog, Project, Lead, InternalDesign } from '../types';

export const PUBLIC_FORM_SECRET = 'acs-creative-portal-v1-992837465';
export const INTERNAL_FORM_SECRET = 'acs-internal-request-v1-554219830';
export const SURVEY_FORM_SECRET = 'acs-project-eval-v1-11223344';

const formatDate = (date: Date) => date.toISOString().split('T')[0];
const dateOffset = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatDate(d);
};

const designers = [
  { id: 'd-sofyan', name: 'SOFYAN', role: 'Creative Director', active: true },
  { id: 'd-mya', name: 'MYA', role: 'Lead Graphic Designer', active: true },
  { id: 'd-pandhu', name: 'PANDHU', role: '3D & Motion Specialist', active: true },
  { id: 'd-abilio', name: 'ABILIO', role: 'Visualizer', active: true }
];

const departments = [
  { id: 'u1', department_name: 'MICE Operations', active: true },
  { id: 'u2', department_name: 'Incentive Travel', active: true },
  { id: 'u3', department_name: 'Brand Strategy', active: true },
  { id: 'u4', department_name: 'Motion Studio', active: true },
  { id: 'u5', department_name: 'Spatial Design', active: true },
  { id: 'u6', department_name: 'Corporate Communications', active: true },
  { id: 'u7', department_name: 'Business Development', active: true },
  { id: 'u8', department_name: 'Event Tech Unit', active: true },
  { id: 'u9', department_name: 'Digital Assets', active: true },
  { id: 'u10', department_name: 'Studio Marketing', active: true }
];

const projects: Project[] = [
  { id: 'p1', project_name: 'Global Tech Summit Bali', start_date: dateOffset(-20), end_date: dateOffset(30), locations: ['Bali'], pic_designer_id: 'd-sofyan', support_designer_ids: ['d-pandhu'], project_type: 'Conference', status: 'ON PROGRESS' },
  { id: 'p2', project_name: 'Nike Sales Kickoff', start_date: dateOffset(-10), end_date: dateOffset(15), locations: ['Jakarta'], pic_designer_id: 'd-mya', support_designer_ids: [], project_type: 'Gathering', status: 'ON PROGRESS' }
];

const leads: Lead[] = Array.from({ length: 15 }, (_, i) => ({
  id: `l${i + 1}`,
  lead_name: `Lead Proposal #${i + 1}`,
  requester: 'Marketing Unit',
  order_date: dateOffset(-10),
  deadline: dateOffset(5),
  lead_grade: 'B',
  brief: 'Creative proposal for new client.',
  drive_link: 'https://drive.google.com/...',
  status: 'ON PROGRESS'
}));

const internalDesigns: InternalDesign[] = [
  { id: 'id-1', task_name: 'Internal Newsletter Jan', department_id: 'u6', requester_name: 'Sarah HR', deadline: dateOffset(5), brief: 'Monthly internal update design.', status: 'ON PROGRESS' },
  { id: 'id-2', task_name: 'Studio Brand Guidelines', department_id: 'u10', requester_name: 'Sofyan CD', deadline: dateOffset(15), brief: 'Updating internal assets.', status: 'NEW' }
];

const artworkLogs: ArtworkLog[] = Array.from({ length: 50 }, (_, i) => {
  const randomDesignerIdx = Math.floor(Math.random() * designers.length);
  const designerId = designers[randomDesignerIdx].id;
  const contexts = [WorkContext.PROJECT, WorkContext.LEAD, WorkContext.INTERNAL];
  const context = contexts[Math.floor(Math.random() * contexts.length)];
  
  return {
    id: `log-${i + 1}`,
    work_context: context,
    project_id: context === WorkContext.PROJECT ? projects[0].id : null,
    lead_id: context === WorkContext.LEAD ? leads[0].id : null,
    internal_design_id: null,
    department_id: context === WorkContext.INTERNAL ? departments[Math.floor(Math.random() * departments.length)].id : null,
    artwork_name: `Artwork #${i + 1}`,
    artwork_type: '2D Design',
    start_date: dateOffset(-5),
    end_date: dateOffset(0),
    pic_designer_id: designerId,
    revision_count: 0,
    approval_required: false,
    notes: 'Logged entry.'
  };
});

export const INITIAL_STATE: AppState = {
  designers,
  departments,
  projects,
  leads,
  internalDesigns,
  artworkLogs,
  projectSurveys: [],
  projectChecklists: [],
  checklistTemplates: [],
  checklistTemplateItems: []
};
