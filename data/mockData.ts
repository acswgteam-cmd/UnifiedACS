
import { WorkContext, AppState, ArtworkLog, Project } from '../types';

const formatDate = (date: Date) => date.toISOString().split('T')[0];
const dateOffset = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatDate(d);
};

// --- Designers ---
const designers = [
  { id: 'd-sofyan', name: 'SOFYAN', role: 'Creative Director', active: true },
  { id: 'd-mya', name: 'MYA', role: 'Lead Graphic Designer', active: true },
  { id: 'd-pandhu', name: 'PANDHU', role: '3D & Motion Specialist', active: true },
  { id: 'd-abilio', name: 'ABILIO', role: 'Visualizer', active: true }
];

// --- Departments (Studio Units) ---
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

// --- Event Projects ---
// Fix: Added status property to all mock projects to comply with the Project interface.
const projects: Project[] = [
  { id: 'p1', project_name: 'Global Tech Summit Bali', start_date: dateOffset(-20), end_date: dateOffset(30), location: 'Bali', pic_designer_id: 'd-sofyan', support_designer_ids: ['d-pandhu'], project_type: 'Conference', status: 'ON PROGRESS' },
  { id: 'p2', project_name: 'Nike Sales Kickoff', start_date: dateOffset(-10), end_date: dateOffset(15), location: 'Jakarta', pic_designer_id: 'd-mya', support_designer_ids: [], project_type: 'Gathering', status: 'ON PROGRESS' },
  { id: 'p3', project_name: 'Toyota Dealer Convention', start_date: dateOffset(-5), end_date: dateOffset(20), location: 'Yogyakarta', pic_designer_id: 'd-pandhu', support_designer_ids: ['d-abilio'], project_type: 'Conference', status: 'ON PROGRESS' },
  { id: 'p4', project_name: 'Incentive Trip: Japan 2025', start_date: dateOffset(-40), end_date: dateOffset(60), location: 'Tokyo', pic_designer_id: 'd-abilio', support_designer_ids: [], project_type: 'Travel', status: 'ON PROGRESS' },
  { id: 'p5', project_name: 'Annual Partners Meet', start_date: dateOffset(-2), end_date: dateOffset(10), location: 'Surabaya', pic_designer_id: 'd-sofyan', support_designer_ids: [], project_type: 'Gathering', status: 'ON PROGRESS' },
  { id: 'p6', project_name: 'Pharma Expo Booth', start_date: dateOffset(-15), end_date: dateOffset(5), location: 'Singapore', pic_designer_id: 'd-pandhu', support_designer_ids: [], project_type: 'Exhibition', status: 'DONE' },
  { id: 'p7', project_name: 'Banking Gala Night', start_date: dateOffset(-8), end_date: dateOffset(12), location: 'Jakarta', pic_designer_id: 'd-mya', support_designer_ids: [], project_type: 'Gathering', status: 'ON PROGRESS' },
  { id: 'p8', project_name: 'Telco Launch Event', start_date: dateOffset(-30), end_date: dateOffset(40), location: 'Bandung', pic_designer_id: 'd-abilio', support_designer_ids: ['d-sofyan'], project_type: 'Launch', status: 'ON PROGRESS' },
  { id: 'p9', project_name: 'Property Awards 2025', start_date: dateOffset(-1), end_date: dateOffset(25), location: 'Bali', pic_designer_id: 'd-sofyan', support_designer_ids: [], project_type: 'Awards', status: 'ON PROGRESS' },
  { id: 'p10', project_name: 'Luxury Travel Fair', start_date: dateOffset(-12), end_date: dateOffset(18), location: 'Jakarta', pic_designer_id: 'd-mya', support_designer_ids: [], project_type: 'Travel', status: 'ON PROGRESS' },
  { id: 'p11', project_name: 'Automotive Media Drive', start_date: dateOffset(-25), end_date: dateOffset(-5), location: 'Lombok', pic_designer_id: 'd-pandhu', support_designer_ids: [], project_type: 'Media', status: 'DONE' },
  { id: 'p12', project_name: 'FMCG Branding Revamp', start_date: dateOffset(-60), end_date: dateOffset(90), location: 'Remote', pic_designer_id: 'd-sofyan', support_designer_ids: [], project_type: 'Branding', status: 'ON PROGRESS' },
  { id: 'p13', project_name: 'Retailer Gathering', start_date: dateOffset(-4), end_date: dateOffset(6), location: 'Medan', pic_designer_id: 'd-abilio', support_designer_ids: [], project_type: 'Gathering', status: 'ON PROGRESS' },
  { id: 'p14', project_name: 'Sustainability Forum', start_date: dateOffset(-20), end_date: dateOffset(10), location: 'Jakarta', pic_designer_id: 'd-mya', support_designer_ids: [], project_type: 'Conference', status: 'ON PROGRESS' },
  { id: 'p15', project_name: 'Gaming Community Meet', start_date: dateOffset(-10), end_date: dateOffset(20), location: 'Jakarta', pic_designer_id: 'd-pandhu', support_designer_ids: [], project_type: 'Gathering', status: 'ON PROGRESS' }
];

// --- Service Inquiries / Leads ---
const leads = Array.from({ length: 30 }, (_, i) => ({
  id: `l${i + 1}`,
  lead_name: [
    'Logo Mockup Request', 'Itinerary Design', 'Stage Visual Pitch', 'Social Media Kit', 'Brochure Revamp', 'Video Bumpers'
  ][i % 6] + ` #${i + 1}`,
  requester: ['Client Alpha', 'Marketing Unit', 'Global Ops', 'Direct Sales'][i % 4],
  order_date: dateOffset(-Math.floor(Math.random() * 20)),
  deadline: dateOffset(Math.floor(Math.random() * 15)),
  lead_grade: ['A', 'B', 'C'][i % 3],
  brief: 'Professional creative service request for upcoming production.',
  drive_link: 'https://drive.google.com/...'
}));

// --- Deliverable Logs (Randomized for variance) ---
const artworkTypes = ['2D Design', '3D Design', 'Video'];
const artworkLogs: ArtworkLog[] = Array.from({ length: 120 }, (_, i) => {
  // Use Random for more natural variance in stats
  const randomDesignerIdx = Math.floor(Math.random() * designers.length);
  const designerId = designers[randomDesignerIdx].id;
  
  const contexts = [WorkContext.PROJECT, WorkContext.LEAD, WorkContext.INTERNAL];
  const context = contexts[Math.floor(Math.random() * contexts.length)];
  
  return {
    id: `log-${i + 1}`,
    work_context: context,
    project_id: context === WorkContext.PROJECT ? projects[Math.floor(Math.random() * projects.length)].id : null,
    lead_id: context === WorkContext.LEAD ? leads[Math.floor(Math.random() * leads.length)].id : null,
    department_id: context === WorkContext.INTERNAL ? departments[Math.floor(Math.random() * departments.length)].id : null,
    artwork_name: [
      'Main Stage LED Backdrop', 'Social Media Carousel', 'Travel Guide Visuals', 'Conference Flyer', 'Motion Logo', 'Spatial 3D Layout'
    ][i % 6] + ` V.${Math.floor(Math.random() * 3) + 1}`,
    artwork_type: artworkTypes[Math.floor(Math.random() * artworkTypes.length)],
    start_date: dateOffset(-Math.floor(Math.random() * 30)),
    end_date: dateOffset(-Math.floor(Math.random() * 5)),
    pic_designer_id: designerId,
    revision_count: Math.floor(Math.random() * 5),
    approval_required: i % 5 === 0,
    notes: 'Studio deliverable logged for MICE/Agency operations.'
  };
});

export const INITIAL_STATE: AppState = {
  designers,
  departments,
  projects,
  leads,
  artworkLogs
};
