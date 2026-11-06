// Several projects on one device: the list for the start page, and opening, creating, copying and deleting them.
import { create } from 'zustand';
import { useProject } from './projectStore';
import { localName } from '../i18n/names';
import {
  autosave,
  deleteProject as deleteStored,
  listProjects,
  loadProjectById,
  onProjectsChanged,
  renameStoredProject,
  saveAsNew,
  setCurrentProjectId,
  type ProjectMeta,
} from './persist';

interface ProjectsState {
  list: ProjectMeta[];
  refresh: () => Promise<void>;
}

export const useProjects = create<ProjectsState>()((set) => ({
  list: [],
  refresh: async () => set({ list: await listProjects() }),
}));
onProjectsChanged((list) => useProjects.setState({ list }));

/** Open a saved project in the editor (the open one is saved first). */
export async function openProject(id: string): Promise<boolean> {
  if (useProject.getState().project?.id === id) return true;
  await autosave.flush();
  const p = await loadProjectById(id);
  if (!p) return false;
  useProject.getState().setLoaded(p);
  setCurrentProjectId(p.id);
  return true;
}

/** Start a new, empty project (optionally with templates); the open one is saved first. */
export async function newProject(templateKeys: string[] = []): Promise<void> {
  await autosave.flush();
  useProject.getState().createProject(templateKeys);
  const p = useProject.getState().project;
  if (!p) return;
  // "Kertem", "Kertem 2", … so the list can tell them apart.
  const names = new Set(useProjects.getState().list.map((m) => localName(m.name)));
  const base = localName(p.name);
  if (names.has(base)) {
    let n = 2;
    while (names.has(`${base} ${n}`)) n++;
    useProject.getState().renameProject(`${base} ${n}`);
  }
  setCurrentProjectId(p.id);
}

export async function duplicateProject(id: string, suffix: string): Promise<void> {
  await autosave.flush();
  const p = useProject.getState().project?.id === id ? useProject.getState().project : await loadProjectById(id);
  if (p) await saveAsNew(p, `${p.name} ${suffix}`);
}

export async function removeProject(id: string): Promise<void> {
  if (useProject.getState().project?.id === id) useProject.getState().setLoaded(null);
  await deleteStored(id);
}

export async function renameProject(id: string, name: string): Promise<void> {
  const n = name.trim();
  if (!n) return;
  if (useProject.getState().project?.id === id) useProject.getState().renameProject(n);
  else await renameStoredProject(id, n);
}
