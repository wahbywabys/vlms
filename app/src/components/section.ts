/**
 * Section (cutaway) views. Each scene keeps its own clipping planes and gives
 * them to the machine's materials only, so the workshop and the student are
 * never cut. Where a plane cuts through a solid, its inside faces are drawn
 * as a hatched section face in the part's own colour, like a sectioned
 * engineering drawing, instead of showing a hollow shell.
 *
 * Modes, seen from the usual front view of the machine:
 *   long     vertical plane along the machine: the front half is removed
 *   cross    vertical plane across it: the right-hand end is removed
 *   plan     horizontal plane: the top is removed (looking down into it)
 *   quarter  the front-top quarter is removed (two planes)
 * `offset` slides the plane through the machine (−1..1 of its size) and
 * `angle` turns long and cross sections about the vertical (oblique cuts).
 */
import * as THREE from 'three';

export type CutMode = 'off' | 'long' | 'cross' | 'plan' | 'quarter';
export interface SectionSpec { mode: CutMode; offset?: number; angle?: number }
export const CUT_MODES: CutMode[] = ['off', 'long', 'cross', 'plan', 'quarter'];

/** Lesson shots may say `cutaway: true`, which means the classic longitudinal section. */
export function toSection(v: boolean | SectionSpec | undefined | null): SectionSpec {
  if (!v) return { mode: 'off' };
  if (v === true) return { mode: 'long' };
  return v;
}

export interface SectionState {
  planes: THREE.Plane[];
  /** 1 while a section is shown; switches the hatched caps on. */
  uniform: { value: number };
  intersect: boolean;
  materials: Set<THREE.Material>;
  /** Assembled size of the machine, for the plane's travel and outline. */
  box: THREE.Box3;
}

export function createSection(): SectionState {
  return { planes: [], uniform: { value: 0 }, intersect: false, materials: new Set(), box: new THREE.Box3(new THREE.Vector3(-2, -1.2, -1), new THREE.Vector3(2, 1.2, 1)) };
}

/** The clipping planes for a section through a machine of size `box`. */
export function sectionPlanes(box: THREE.Box3, spec: SectionSpec): THREE.Plane[] {
  const { mode, offset = 0, angle = 0 } = spec;
  const c = box.getCenter(new THREE.Vector3());
  const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const planes: THREE.Plane[] = [];
  const turn = (n: THREE.Vector3) => n.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
  const plane = (n: THREE.Vector3, through: THREE.Vector3) => new THREE.Plane().setFromNormalAndCoplanarPoint(n, through);
  if (mode === 'long') planes.push(plane(turn(new THREE.Vector3(0, 0, -1)), new THREE.Vector3(c.x, c.y, c.z + offset * half.z)));
  else if (mode === 'cross') planes.push(plane(turn(new THREE.Vector3(-1, 0, 0)), new THREE.Vector3(c.x + offset * half.x, c.y, c.z)));
  else if (mode === 'plan') planes.push(plane(new THREE.Vector3(0, -1, 0), new THREE.Vector3(c.x, c.y + offset * half.y, c.z)));
  else if (mode === 'quarter') {
    planes.push(plane(new THREE.Vector3(0, 0, -1), new THREE.Vector3(c.x, c.y, c.z + offset * half.z)));
    planes.push(plane(new THREE.Vector3(0, -1, 0), new THREE.Vector3(c.x, c.y + offset * half.y, c.z)));
  }
  return planes;
}

/** Move the planes to the requested section. Materials pick the change up on the next frame. */
export function applySection(s: SectionState, spec: SectionSpec) {
  const planes = sectionPlanes(s.box, spec);
  s.planes.length = 0;
  s.planes.push(...planes);
  s.uniform.value = planes.length ? 1 : 0;
  const intersect = spec.mode === 'quarter';
  if (intersect !== s.intersect) {
    s.intersect = intersect;
    for (const m of s.materials) { m.clipIntersection = intersect; m.needsUpdate = true; }
  }
}

/** Give a machine material the scene's planes and the hatched section face. Safe to call repeatedly. */
export function sectionMaterial(s: SectionState, m: THREE.Material) {
  if (s.materials.has(m)) return;
  s.materials.add(m);
  m.clippingPlanes = s.planes;
  m.clipIntersection = s.intersect;
  m.clipShadows = true;
  // See-through parts (guards, glass) are cut but not capped.
  if (m.userData.orig ? m.userData.orig.transparent : m.transparent) return;
  m.side = THREE.DoubleSide;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (shader, r) => {
    prev?.call(m, shader, r);
    shader.uniforms.uCut = s.uniform;
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float uCut;\nvoid main() {')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
  if (uCut > 0.5 && !gl_FrontFacing) {
    float hatch = step(0.62, fract((gl_FragCoord.x + gl_FragCoord.y) / 9.0));
    vec3 face = mix(diffuseColor.rgb * 0.92 + 0.06, vec3(0.06, 0.07, 0.08), hatch * 0.55);
    gl_FragColor = vec4(face, 1.0);
  }`);
  };
  const key = m.customProgramCacheKey?.bind(m);
  m.customProgramCacheKey = () => `${key ? key() : ''}|section`;
  m.needsUpdate = true;
}
