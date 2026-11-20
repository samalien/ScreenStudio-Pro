/**
 * Renderer-side typed facade over window.electronAPI.
 * Components should import from here instead of touching window directly.
 */

export function getAPI() {
  if (typeof window === 'undefined' || !window.electronAPI) {
    throw new Error('electronAPI is not available. Run inside Electron.');
  }
  return window.electronAPI;
}

export async function getServicesStatus() {
  try {
    return await getAPI().services.status();
  } catch {
    return null;
  }
}

export async function createProject(name: string) {
  return getAPI().project.create(name);
}

export async function saveProject(project: unknown, filePath?: string) {
  return getAPI().project.save(project, filePath);
}

export async function loadProject(filePath: string) {
  return getAPI().project.load(filePath);
}

export async function listRecentProjects(limit?: number) {
  return getAPI().project.listRecent(limit);
}

export async function openProjectDialog() {
  return getAPI().project.openDialog();
}

export async function saveProjectDialog(defaultName: string) {
  return getAPI().project.saveDialog(defaultName);
}

export async function getFFmpegStatus() {
  return getAPI().ffmpeg.status();
}

export async function checkFeature(feature: string) {
  return getAPI().security.checkFeature(feature);
}

export async function getLicense(key?: string) {
  return getAPI().security.validateLicense(key);
}
