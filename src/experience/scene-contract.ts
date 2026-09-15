import type { sampleDepth } from './depth-model';

export type DepthState = ReturnType<typeof sampleDepth>;
export type QualityTier = 'low' | 'medium' | 'high';
export type SceneStatus = 'ready' | 'paused' | 'lost' | 'failed' | 'disposed';
export type Viewport = { width: number; height: number; dpr: number };
export type SceneDiagnostics = {
  status: SceneStatus;
  quality: QualityTier;
  frames: number;
  particles: number;
  drawCalls: number;
  geometries: number;
  textures: number;
  programs: number;
  pixelCount: number;
  renderTargets: number;
  contextLosses: number;
  recoveries: number;
  frameMs: number;
  [key: string]: unknown;
};
export type SceneOptions = {
  onStatus: (status: SceneStatus, reason?: string) => void;
};
export interface OceanScene {
  update(timeMs: number, deltaSeconds: number, depth: DepthState): void;
  resize(viewport: Viewport, quality?: QualityTier): void;
  pause(): void;
  resume(): void;
  dispose(): void;
  diagnostics(): SceneDiagnostics;
}
