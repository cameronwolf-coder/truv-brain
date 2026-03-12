import { useEffect, useCallback } from 'react';
import { get, set, del, keys } from 'idb-keyval';
import { useVideoEditor } from './useVideoEditor';
import type { Project } from '../types/videoEditor';

const PROJECT_PREFIX = 'truv-video-project:';

export function useProjectPersistence() {
  const {
    sourceFile,
    analysis,
    approvedSegments,
  } = useVideoEditor();

  // Auto-save when segments change
  useEffect(() => {
    if (!sourceFile || !analysis) return;

    const project: Omit<Project, 'id'> & { id: string } = {
      id: `${PROJECT_PREFIX}${sourceFile.name}`,
      name: sourceFile.name.replace(/\.[^.]+$/, ''),
      sourceFileName: sourceFile.name,
      analysis,
      approvedSegments,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Preserve original createdAt
    get(project.id).then((existing) => {
      if (existing) project.createdAt = (existing as Project).createdAt;
      set(project.id, project);
    });
  }, [sourceFile, analysis, approvedSegments]);

  const listProjects = useCallback(async (): Promise<Project[]> => {
    const allKeys = await keys();
    const projectKeys = allKeys.filter(
      (k) => typeof k === 'string' && k.startsWith(PROJECT_PREFIX)
    );
    const projects = await Promise.all(projectKeys.map((k) => get(k)));
    return (projects.filter(Boolean) as Project[]).sort(
      (a, b) => b.updatedAt - a.updatedAt
    );
  }, []);

  const loadProject = useCallback(
    async (id: string) => {
      const project = (await get(id)) as Project | undefined;
      if (!project) return null;

      const store = useVideoEditor.getState();
      if (project.analysis) store.setAnalysis(project.analysis);
      project.approvedSegments.forEach((seg) => store.approveSegment(seg));

      return project;
    },
    []
  );

  const deleteProject = useCallback(async (id: string) => {
    await del(id);
  }, []);

  return { listProjects, loadProject, deleteProject };
}
