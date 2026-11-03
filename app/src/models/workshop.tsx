/**
 * The WABYS training workshop the machines stand in: epoxy floor with painted
 * walkways and machine zones, steel columns, high-bay lights, windows, a
 * roller door, benches and tool boards, a PPE station, fire and first-aid
 * points with ISO 7010 signs, and each trade's own equipment around the bay
 * (lathes and a mill, a car on a lift, wiring boards, welding booths).
 *
 * Built in metres and scaled into the machine's model space by `env.unitsPerM`,
 * so everything is at true scale next to the machine and the student. Signs
 * follow the interface language. Also here: the stands machines sit on, and
 * the environment lighting (light panels for reflections, no downloads).
 */
import { Environment, Lightformer } from '@react-three/drei';
import { useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import type { ModelEnv } from './kit';
import type { Rect } from './avatar';
import { floorTex, hazardTex, pegboardTex, plateTex, shutterTex, signTex, wabysTex, type Pictogram, type SignKind } from './textures';
import type { Vec3 } from '../components/MachineExplorer';

type Lang = 'en' | 'ar';
const ROOM = { w: 26, d: 22, h: 7 };

function S({ color, rough = 0.7, metal = 0.1, map, emissive, glow = 0, side, opacity }: {
  color: string; rough?: number; metal?: number; map?: THREE.Texture | null; emissive?: string; glow?: number; side?: THREE.Side; opacity?: number;
}) {
  return <meshStandardMaterial color={color} roughness={rough} metalness={metal} map={map ?? null} emissive={emissive ?? '#000'} emissiveIntensity={glow}
    side={side ?? THREE.FrontSide} transparent={opacity !== undefined} opacity={opacity ?? 1} depthWrite={opacity === undefined} />;
}

function B({ size, position, rotation, color, rough, metal, map, cast = true, emissive, glow, opacity }: {
  size: Vec3; position: Vec3; rotation?: Vec3; color: string; rough?: number; metal?: number; map?: THREE.Texture | null; cast?: boolean; emissive?: string; glow?: number; opacity?: number;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow={cast} receiveShadow>
      <boxGeometry args={size} />
      <S color={color} rough={rough} metal={metal} map={map} emissive={emissive} glow={glow} opacity={opacity} />
    </mesh>
  );
}

function C({ r, r2, h, position, rotation, color, rough, metal, seg = 20, emissive, glow }: {
  r: number; r2?: number; h: number; position: Vec3; rotation?: Vec3; color: string; rough?: number; metal?: number; seg?: number; emissive?: string; glow?: number;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <cylinderGeometry args={[r, r2 ?? r, h, seg]} />
      <S color={color} rough={rough} metal={metal} emissive={emissive} glow={glow} />
    </mesh>
  );
}

/** A sign on a wall, facing +z in its own frame. */
function Sign({ kind, pic, text, lang, position, rotation, size = 0.42 }: {
  kind: SignKind; pic: Pictogram; text: string; lang: Lang; position: Vec3; rotation?: Vec3; size?: number;
}) {
  const tex = useMemo(() => signTex(kind, pic, text, lang === 'ar'), [kind, pic, text, lang]);
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[size, size * (340 / 256)]} />
      <S color="#ffffff" map={tex} rough={0.5} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Banner({ lang, position, rotation }: { lang: Lang; position: Vec3; rotation?: Vec3 }) {
  const tex = useMemo(() => wabysTex('banner', lang === 'ar' ? 'ورشة التدريب التقني · VTC_LMS' : 'Technical Training Workshop · VTC_LMS'), [lang]);
  return <mesh position={position} rotation={rotation}><planeGeometry args={[6.4, 1.6]} /><S color="#ffffff" map={tex} rough={0.6} /></mesh>;
}

const T = (lang: Lang, en: string, ar: string) => (lang === 'ar' ? ar : en);

// ---------------------------------------------------------------------------
// The room
// ---------------------------------------------------------------------------
function Room({ lang }: { lang: Lang }) {
  const floor = useMemo(() => floorTex([6, 5]), []);
  const hazard = useMemo(() => hazardTex([1, 4]), []);
  const shutter = useMemo(() => shutterTex(), []);
  const { w, d, h } = ROOM;
  const wall = (len: number, pos: Vec3, rotY: number) => (
    <group position={pos} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.7, 0]} receiveShadow><planeGeometry args={[len, 1.4]} /><S color="#24375f" rough={0.55} /></mesh>
      <mesh position={[0, 1.42, 0.005]}><planeGeometry args={[len, 0.06]} /><S color="#f06721" rough={0.5} /></mesh>
      <mesh position={[0, (h + 1.4) / 2, 0]} receiveShadow><planeGeometry args={[len, h - 1.4]} /><S color="#d6dade" rough={0.85} /></mesh>
    </group>
  );
  const windows = (len: number, pos: Vec3, rotY: number) => (
    <group position={pos} rotation={[0, rotY, 0]}>
      {Array.from({ length: Math.floor(len / 2.4) }, (_, i) => {
        const x = -len / 2 + 1.4 + i * 2.4;
        return (
          <group key={i} position={[x, 5.0, 0.02]}>
            <mesh><planeGeometry args={[2.0, 1.5]} /><S color="#cfe6ff" emissive="#dcefff" glow={1.4} rough={0.1} /></mesh>
            {[-0.5, 0.5].map((xx) => <B key={xx} size={[0.05, 1.5, 0.04]} position={[xx, 0, 0.02]} color="#4a525b" cast={false} />)}
            <B size={[2.0, 0.05, 0.04]} position={[0, 0, 0.02]} color="#4a525b" cast={false} />
            <B size={[2.08, 0.08, 0.12]} position={[0, -0.78, 0.05]} color="#7d868f" cast={false} />
          </group>
        );
      })}
    </group>
  );
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial map={floor} roughness={0.55} metalness={0.05} envMapIntensity={0.6} />
      </mesh>
      {wall(w, [0, 0, -d / 2], 0)}
      {wall(w, [0, 0, d / 2], Math.PI)}
      {wall(d, [-w / 2, 0, 0], Math.PI / 2)}
      {wall(d, [w / 2, 0, 0], -Math.PI / 2)}
      {windows(d - 4, [-w / 2 + 0.01, 0, 0], Math.PI / 2)}
      {windows(w - 6, [0, 0, -d / 2 + 0.01], 0)}
      {/* Ceiling, trusses and high-bay lights */}
      <mesh position={[0, h, 0]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[w, d]} /><S color="#3a4047" rough={0.9} /></mesh>
      {[-8, -2.5, 3, 8.5].map((z) => (
        <group key={z} position={[0, h - 0.45, z]}>
          <B size={[w, 0.12, 0.12]} position={[0, 0, 0]} color="#5d6670" metal={0.5} cast={false} />
          <B size={[w, 0.08, 0.08]} position={[0, -0.35, 0]} color="#5d6670" metal={0.5} cast={false} />
          {[-9, -3, 3, 9].map((x) => (
            <group key={x} position={[x, -0.9, 0]}>
              <C r={0.05} h={0.6} position={[0, 0.35, 0]} color="#2b2f34" />
              <C r={0.18} r2={0.4} h={0.32} position={[0, 0, 0]} color="#c9ced3" metal={0.6} rough={0.35} seg={24} />
              <mesh position={[0, -0.17, 0]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.37, 24]} /><S color="#fffbe8" emissive="#fff6dc" glow={3} side={THREE.DoubleSide} /></mesh>
            </group>
          ))}
        </group>
      ))}
      {/* Steel columns with hazard-striped base guards */}
      {[-10, -4, 2, 8].map((x) => [-d / 2 + 0.2, d / 2 - 0.2].map((z) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <B size={[0.32, h, 0.32]} position={[0, h / 2, 0]} color="#1f3566" metal={0.4} rough={0.5} />
          <mesh position={[0, 0.5, 0]}><boxGeometry args={[0.4, 1.0, 0.4]} /><S color="#ffffff" map={hazard} rough={0.6} /></mesh>
        </group>
      )))}
      {/* Roller door with a striped frame */}
      <group position={[w / 2 - 0.02, 0, 5]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh position={[0, 2.25, 0.01]}><planeGeometry args={[4.2, 4.5]} /><S color="#ffffff" map={shutter} metal={0.5} rough={0.4} /></mesh>
        <mesh position={[-2.2, 2.3, 0.02]}><planeGeometry args={[0.2, 4.6]} /><S color="#ffffff" map={hazard} /></mesh>
        <mesh position={[2.2, 2.3, 0.02]}><planeGeometry args={[0.2, 4.6]} /><S color="#ffffff" map={hazard} /></mesh>
        <mesh position={[0, 4.62, 0.02]}><planeGeometry args={[4.6, 0.2]} /><S color="#ffffff" map={hazard} /></mesh>
        <Sign kind="safe" pic="exit" text={T(lang, 'Emergency exit', 'مخرج طوارئ')} lang={lang} position={[3.1, 2.4, 0.03]} size={0.5} />
      </group>
      <Banner lang={lang} position={[0, 4.2, -d / 2 + 0.03]} />
    </group>
  );
}

/** Painted floor markings: the machine's safety zone and a walkway. */
function FloorMarks({ zone }: { zone: Rect }) {
  const hazard = useMemo(() => hazardTex([8, 1]), []);
  const y = 0.004;
  const line = (x: number, z: number, lx: number, lz: number, c = '#f2c230') => (
    <mesh key={`${x}${z}${lx}`} position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[lx, lz]} /><S color={c} rough={0.5} /></mesh>
  );
  const { minX, maxX, minZ, maxZ } = zone;
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2, w = maxX - minX, d = maxZ - minZ;
  return (
    <group>
      {line(cx, minZ, w, 0.08)}{line(cx, maxZ, w, 0.08)}{line(minX, cz, 0.08, d)}{line(maxX, cz, 0.08, d)}
      {/* Hazard strip on the operator's side */}
      <mesh position={[cx, y + 0.001, maxZ + 0.18]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[w, 0.22]} /><S color="#ffffff" map={hazard} rough={0.5} /></mesh>
      {/* Walkway */}
      {line(0, maxZ + 2.4, ROOM.w - 1, 0.1, '#e9edf0')}{line(0, maxZ + 4.0, ROOM.w - 1, 0.1, '#e9edf0')}
      {[-8, -3, 2, 7].map((x) => (
        <mesh key={x} position={[x, y, maxZ + 3.2]} rotation={[-Math.PI / 2, 0, -Math.PI / 2]}>
          <circleGeometry args={[0.35, 3]} /><S color="#2f9e57" rough={0.5} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Furniture and safety points
// ---------------------------------------------------------------------------
function BenchAndTools({ lang }: { lang: Lang }) {
  const peg = useMemo(() => pegboardTex(), []);
  return (
    <group position={[-6, 0, -ROOM.d / 2 + 0.6]}>
      <B size={[2.6, 0.06, 0.8]} position={[0, 0.9, 0]} color="#8a5a33" rough={0.8} />
      {[-1.2, 1.2].map((x) => [-0.32, 0.32].map((z) => <B key={`${x}${z}`} size={[0.06, 0.9, 0.06]} position={[x, 0.45, z]} color="#3e4650" metal={0.5} />))}
      <B size={[2.5, 0.04, 0.7]} position={[0, 0.2, 0]} color="#4b545e" metal={0.4} />
      {/* Vice */}
      <group position={[0.9, 0.98, 0.25]}>
        <B size={[0.22, 0.1, 0.16]} position={[0, 0, 0]} color="#2f5f93" metal={0.4} rough={0.4} />
        <B size={[0.22, 0.08, 0.04]} position={[0, 0.09, 0.07]} color="#7c858e" metal={0.8} rough={0.3} />
        <B size={[0.22, 0.08, 0.04]} position={[0, 0.09, -0.04]} color="#7c858e" metal={0.8} rough={0.3} />
        <C r={0.012} h={0.3} position={[0, 0.06, 0.2]} rotation={[Math.PI / 2, 0, 0]} color="#c3cbd3" metal={0.9} rough={0.2} />
      </group>
      <mesh position={[0, 1.75, -0.38]}><planeGeometry args={[2.6, 1.3]} /><S color="#ffffff" map={peg} rough={0.8} /></mesh>
      {/* Tool chest */}
      <group position={[3.2, 0, 0]}>
        <B size={[1.1, 1.05, 0.55]} position={[0, 0.6, 0]} color="#b8282a" metal={0.3} rough={0.4} />
        {[0.25, 0.45, 0.65, 0.85, 1.0].map((y) => <B key={y} size={[1.0, 0.012, 0.01]} position={[0, y, 0.28]} color="#6b1414" cast={false} />)}
        {[0.33, 0.55, 0.75, 0.93].map((y) => <B key={y} size={[0.5, 0.025, 0.03]} position={[0, y, 0.29]} color="#d7dde2" metal={0.9} rough={0.2} cast={false} />)}
        {[-0.45, 0.45].map((x) => <C key={x} r={0.04} h={0.04} position={[x, 0.04, 0.2]} rotation={[0, 0, Math.PI / 2]} color="#1b1d20" />)}
      </group>
      <Sign kind="mandatory" pic="glasses" text={T(lang, 'Eye protection must be worn', 'يجب ارتداء واقي العين')} lang={lang} position={[5.2, 2.0, -0.38]} />
      <Sign kind="mandatory" pic="boots" text={T(lang, 'Safety footwear must be worn', 'يجب ارتداء حذاء السلامة')} lang={lang} position={[5.8, 2.0, -0.38]} />
    </group>
  );
}

function SafetyPoint({ lang }: { lang: Lang }) {
  return (
    <group position={[-ROOM.w / 2 + 0.25, 0, -3]} rotation={[0, Math.PI / 2, 0]}>
      {/* Fire extinguisher on its bracket */}
      <group position={[0, 0, 0.15]}>
        <C r={0.09} h={0.55} position={[0, 1.0, 0]} color="#c8312b" metal={0.3} rough={0.35} />
        <mesh position={[0, 1.27, 0]}><sphereGeometry args={[0.09, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><S color="#c8312b" metal={0.3} rough={0.35} /></mesh>
        <B size={[0.06, 0.1, 0.06]} position={[0, 1.36, 0]} color="#1b1d20" />
        <B size={[0.16, 0.25, 0.02]} position={[0, 0.98, 0.09]} color="#f2f2ee" cast={false} />
        <B size={[0.04, 0.04, 0.14]} position={[0, 0.7, -0.08]} color="#3e4650" />
      </group>
      <Sign kind="fire" pic="extinguisher" text={T(lang, 'Fire extinguisher', 'طفاية حريق')} lang={lang} position={[0, 1.85, 0.02]} size={0.36} />
      {/* First aid and eyewash */}
      <group position={[1.2, 0, 0]}>
        <B size={[0.5, 0.5, 0.18]} position={[0, 1.5, 0.09]} color="#2f9e57" rough={0.4} />
        <B size={[0.08, 0.3, 0.01]} position={[0, 1.5, 0.185]} color="#ffffff" cast={false} />
        <B size={[0.3, 0.08, 0.01]} position={[0, 1.5, 0.185]} color="#ffffff" cast={false} />
        <Sign kind="safe" pic="firstAid" text={T(lang, 'First aid', 'إسعافات أولية')} lang={lang} position={[0, 2.1, 0.02]} size={0.36} />
      </group>
      <group position={[2.2, 0, 0]}>
        <B size={[0.34, 0.5, 0.2]} position={[0, 1.4, 0.1]} color="#2f9e57" />
        <C r={0.05} h={0.12} position={[-0.08, 1.2, 0.22]} rotation={[Math.PI / 2, 0, 0]} color="#f2c230" />
        <C r={0.05} h={0.12} position={[0.08, 1.2, 0.22]} rotation={[Math.PI / 2, 0, 0]} color="#f2c230" />
        <Sign kind="safe" pic="eyewash" text={T(lang, 'Eye wash', 'غسيل العين')} lang={lang} position={[0, 2.0, 0.02]} size={0.36} />
      </group>
    </group>
  );
}

/** The PPE station: signs and hooks with the kit, at the station the student uses to get ready. */
function PpeStation({ lang, trade }: { lang: Lang; trade: string }) {
  const signs: [SignKind, Pictogram, string, string][] = [
    ['mandatory', 'glasses', 'Eye protection', 'واقي العين'],
    ['mandatory', 'boots', 'Safety boots', 'حذاء السلامة'],
    trade === 'weld' ? ['mandatory', 'welding', 'Welding helmet', 'خوذة اللحام'] : trade === 'elec' ? ['mandatory', 'gloves', 'Insulated gloves', 'قفازات عازلة']
      : trade === 'rmg' ? ['mandatory', 'hairnet', 'Tie back long hair', 'اربط الشعر الطويل'] : trade === 'ait' ? ['mandatory', 'exclaim', 'Respect the light curtain', 'احترم الستارة الضوئية']
      : trade === 'prt' ? ['mandatory', 'gloves', 'Nitrile gloves for washes', 'قفازات نيتريل للمنظفات']
      : trade === 'iel' || trade === 'ave' || trade === 'csn' ? ['mandatory', 'exclaim', 'Wear the ESD wrist strap', 'ارتدِ سوار التفريغ']
      : trade === 'rac' ? ['mandatory', 'gloves', 'Gloves for refrigerant and brazing', 'قفازات لوسيط التبريد واللحام']
      : trade === 'iem' ? ['mandatory', 'lockout', 'Lock out before you work', 'اقفل قبل العمل']
      : trade === 'ham' || trade === 'oeq' ? ['mandatory', 'electric', 'Unplug before you open', 'افصل القابس قبل الفتح'] : ['mandatory', 'ear', 'Ear protection', 'واقي السمع'],
    trade === 'rac' ? ['prohibition', 'noFlame', 'No flames near A3 refrigerant', 'ممنوع اللهب قرب وسيط التبريد A3'] : trade === 'oeq' ? ['warning', 'hot', 'Hot fuser', 'وحدة تثبيت ساخنة']
      : trade === 'cnc' || trade === 'eim' || trade === 'prt' || trade === 'iem' ? ['prohibition', 'gloves', 'No gloves at rotating machines', 'ممنوع القفازات عند الماكينات الدوارة'] : trade === 'weld' ? ['mandatory', 'apron', 'Leather apron', 'مريلة جلدية'] : ['prohibition', 'noJewel', 'No jewellery', 'ممنوع الحلي'],
  ];
  return (
    <group>
      <B size={[1.7, 1.25, 0.04]} position={[0, 1.45, 0]} color="#e8ebee" rough={0.6} />
      <B size={[1.76, 0.1, 0.06]} position={[0, 2.1, 0]} color="#14234c" />
      <Header3 text={T(lang, 'PPE station', 'محطة معدات الوقاية')} position={[0, 2.1, 0.035]} />
      {[-0.78, 0.78].map((x) => <B key={x} size={[0.05, 2.1, 0.05]} position={[x, 1.05, -0.03]} color="#3e4650" metal={0.5} />)}
      {signs.map(([k, p, en, ar], i) => (
        <Sign key={p + i} kind={k} pic={p} text={T(lang, en, ar)} lang={lang} position={[-0.6 + i * 0.4, 1.7, 0.025]} size={0.32} />
      ))}
      {/* Hooks with the kit */}
      <group position={[0, 1.02, 0.06]}>
        <mesh position={[-0.55, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.05, 0.05, 0.04, 14]} /><S color="#f06721" /></mesh>
        <mesh position={[-0.2, 0, 0.02]} rotation={[0, Math.PI, 0]}><cylinderGeometry args={[0.1, 0.1, 0.04, 16, 1, true, 0, Math.PI]} /><S color="#9ad0ff" opacity={0.6} side={THREE.DoubleSide} /></mesh>
        <B size={[0.08, 0.16, 0.03]} position={[0.15, -0.04, 0]} color={trade === 'elec' ? '#e0601a' : trade === 'auto' ? '#3769d1' : '#a8743f'} />
        <B size={[0.08, 0.16, 0.03]} position={[0.26, -0.04, 0]} color={trade === 'elec' ? '#e0601a' : trade === 'auto' ? '#3769d1' : '#a8743f'} />
        {trade === 'weld' && <B size={[0.24, 0.28, 0.16]} position={[0.58, -0.05, 0.04]} color="#24272b" />}
      </group>
      <B size={[1.6, 0.04, 0.3]} position={[0, 0.82, 0.14]} color="#59616a" metal={0.4} />
    </group>
  );
}

function Header3({ text, position }: { text: string; position: Vec3 }) {
  const tex = useMemo(() => plateTex([text], { bg: '#14234c', fg: '#ffffff', border: '#14234c', w: 1024, h: 60, align: 'center' }), [text]);
  return <mesh position={position}><planeGeometry args={[1.7, 0.1]} /><S color="#ffffff" map={tex} /></mesh>;
}

// ---------------------------------------------------------------------------
// Each trade's equipment around the bay (background only, not interactive)
// ---------------------------------------------------------------------------
function CncBay() {
  const lathe = (pos: Vec3, rot = 0) => (
    <group position={pos} rotation={[0, rot, 0]}>
      <B size={[3.2, 0.9, 1.1]} position={[0, 0.45, 0]} color="#2b3a4a" rough={0.6} />
      <B size={[3.1, 1.0, 1.0]} position={[0, 1.4, -0.05]} color="#e8ebee" rough={0.45} />
      <B size={[1.6, 0.7, 0.02]} position={[0.2, 1.45, 0.47]} color="#9fd3ff" opacity={0.35} rough={0.05} />
      <B size={[3.12, 0.08, 1.02]} position={[0, 1.94, -0.05]} color="#f06721" />
      <B size={[0.45, 0.65, 0.12]} position={[1.75, 1.45, 0.35]} color="#2b3a4a" />
      <B size={[0.34, 0.24, 0.01]} position={[1.75, 1.58, 0.42]} color="#0c2b3f" emissive="#1b6fa8" glow={0.8} cast={false} />
    </group>
  );
  return (
    <group>
      {lathe([7.5, 0, -6.5])}
      {lathe([-7.5, 0, -6.5])}
      {/* Vertical mill */}
      <group position={[10, 0, 1]} rotation={[0, -Math.PI / 2, 0]}>
        <B size={[0.9, 1.6, 0.9]} position={[0, 0.8, -0.3]} color="#4b6a8c" rough={0.5} />
        <B size={[0.55, 0.8, 0.8]} position={[0, 2.0, 0.0]} color="#4b6a8c" rough={0.5} />
        <C r={0.08} h={0.3} position={[0, 1.5, 0.2]} color="#9aa5b0" metal={0.9} rough={0.2} />
        <B size={[1.3, 0.12, 0.45]} position={[0, 1.05, 0.35]} color="#8d969f" metal={0.7} rough={0.3} />
      </group>
      {/* Bar stock rack */}
      <group position={[-10.5, 0, 3]}>
        {[0.4, 0.9, 1.4].map((y) => <B key={y} size={[0.6, 0.05, 2.4]} position={[0, y, 0]} color="#3e4650" metal={0.5} />)}
        {[0.47, 0.97, 1.47].map((y) => [-0.2, -0.05, 0.1, 0.22].map((x) => <C key={`${x}${y}`} r={0.03} h={2.3} position={[x, y, 0]} rotation={[Math.PI / 2, 0, 0]} color="#a9b2ba" metal={0.9} rough={0.25} />))}
      </group>
    </group>
  );
}

function AutoBay() {
  const wheel = (p: Vec3) => (
    <group position={p}>
      <C r={0.33} h={0.22} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} color="#16181a" rough={0.8} seg={28} />
      <C r={0.2} h={0.23} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} color="#b9c1c9" metal={0.8} rough={0.3} />
    </group>
  );
  return (
    <group>
      {/* Two-post lift with a car raised */}
      <group position={[-7.5, 0, -5]}>
        {[-1.4, 1.4].map((z) => (
          <group key={z}>
            <B size={[0.35, 3.6, 0.35]} position={[0, 1.8, z]} color="#2f5f93" metal={0.3} rough={0.5} />
            <B size={[0.6, 0.02, 0.6]} position={[0, 0.01, z]} color="#f2c230" />
          </group>
        ))}
        <group position={[0, 1.55, 0]}>
          <B size={[4.2, 0.75, 1.75]} position={[0, 0.35, 0]} color="#b8282a" metal={0.4} rough={0.3} />
          <B size={[2.2, 0.62, 1.6]} position={[-0.2, 1.0, 0]} color="#b8282a" metal={0.4} rough={0.3} />
          <B size={[2.1, 0.5, 1.62]} position={[-0.2, 1.02, 0]} color="#1d2a36" rough={0.05} metal={0.6} />
          {[[-1.35, 0.85], [1.35, 0.85], [-1.35, -0.85], [1.35, -0.85]].map(([x, z]) => wheel([x!, -0.02, z!]))}
          <B size={[0.1, 0.2, 1.4]} position={[2.12, 0.3, 0]} color="#dadfe3" emissive="#fff7d6" glow={0.4} />
        </group>
      </group>
      {/* Tyre stack and trolley jack */}
      <group position={[9.5, 0, -6]}>
        {[0, 1, 2, 3].map((i) => <C key={i} r={0.33} h={0.22} position={[0, 0.12 + i * 0.23, 0]} color="#16181a" rough={0.85} seg={24} />)}
      </group>
      <group position={[8, 0, 2]}>
        <B size={[1.0, 0.16, 0.36]} position={[0, 0.14, 0]} color="#f2c230" />
        <B size={[0.5, 0.06, 0.06]} position={[0.6, 0.6, 0]} rotation={[0, 0, 0.9]} color="#3e4650" />
        {[-0.4, 0.4].map((x) => <C key={x} r={0.06} h={0.05} position={[x, 0.06, 0.18]} rotation={[Math.PI / 2, 0, 0]} color="#1b1d20" />)}
      </group>
      <group position={[-10.5, 0, 3]}>
        <B size={[1.4, 1.0, 0.6]} position={[0, 0.5, 0]} color="#2f5f93" />
        <B size={[0.04, 0.04, 0.5]} position={[0.75, 1.0, 0]} color="#c3cbd3" metal={0.9} />
      </group>
    </group>
  );
}

function ElecBay() {
  const board = (x: number) => (
    <group position={[x, 0, -ROOM.d / 2 + 0.25]}>
      <B size={[2.2, 2.4, 0.06]} position={[0, 1.6, 0]} color="#e9ecef" rough={0.6} />
      {[2.3, 1.8, 1.3].map((y) => <B key={y} size={[1.9, 0.05, 0.03]} position={[0, y, 0.05]} color="#b8bfc6" metal={0.8} rough={0.3} />)}
      {[2.3, 1.8, 1.3].map((y) => Array.from({ length: 7 }, (_, i) => <B key={`${y}${i}`} size={[0.12, 0.3, 0.12]} position={[-0.8 + i * 0.26, y, 0.1]} color={i % 3 === 0 ? '#2a2e33' : '#eceff1'} rough={0.5} />))}
      <B size={[2.0, 0.1, 0.1]} position={[0, 2.62, 0.06]} color="#9ea7ae" />
    </group>
  );
  return (
    <group>
      {board(-8)}{board(-5.2)}{board(5.2)}{board(8)}
      {/* Cable drums and a step ladder */}
      {[[9.5, 1.5], [10.5, 2.3]].map(([x, z]) => (
        <group key={x} position={[x!, 0.45, z!]} rotation={[0, 0.4, 0]}>
          <C r={0.45} h={0.08} position={[0, 0, -0.28]} rotation={[Math.PI / 2, 0, 0]} color="#8a5a33" />
          <C r={0.45} h={0.08} position={[0, 0, 0.28]} rotation={[Math.PI / 2, 0, 0]} color="#8a5a33" />
          <C r={0.3} h={0.5} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} color={x === 9.5 ? '#3a3f45' : '#c27a3a'} rough={0.5} />
        </group>
      ))}
      <group position={[-10, 0, 3]} rotation={[0, 0.3, 0]}>
        {[-0.25, 0.25].map((x) => <B key={x} size={[0.05, 1.9, 0.08]} position={[x, 0.95, 0]} rotation={[0.18, 0, 0]} color="#c3cbd3" metal={0.7} />)}
        {[0.4, 0.8, 1.2, 1.6].map((y) => <B key={y} size={[0.5, 0.03, 0.12]} position={[0, y, 0.18 - y * 0.12]} color="#c3cbd3" metal={0.7} />)}
      </group>
    </group>
  );
}

function WeldBay() {
  const booth = (x: number) => (
    <group position={[x, 0, -6]}>
      {[[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]].map(([px, pz]) => <B key={`${px}${pz}`} size={[0.05, 2.2, 0.05]} position={[px!, 1.1, pz!]} color="#3e4650" metal={0.5} />)}
      <mesh position={[0, 1.1, 1.2]}><planeGeometry args={[2.4, 1.9]} /><S color="#c23b22" opacity={0.55} rough={0.3} side={THREE.DoubleSide} /></mesh>
      <mesh position={[-1.2, 1.1, 0]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[2.4, 1.9]} /><S color="#c23b22" opacity={0.55} rough={0.3} side={THREE.DoubleSide} /></mesh>
      <B size={[1.2, 0.06, 0.8]} position={[0, 0.85, -0.6]} color="#59616a" metal={0.6} />
      <C r={0.12} h={1.4} position={[0.6, 2.5, -0.9]} rotation={[0.5, 0, 0]} color="#f2c230" />
      <C r={0.2} r2={0.12} h={0.25} position={[0.6, 1.85, -0.55]} rotation={[0.5, 0, 0]} color="#f2c230" />
    </group>
  );
  return (
    <group>
      {booth(-8.5)}{booth(-5.5)}{booth(6.5)}{booth(9.5)}
      <group position={[-10.5, 0, 3]}>
        {[0.3, 0.7, 1.1].map((y) => <B key={y} size={[0.8, 0.04, 1.8]} position={[0, y, 0]} color="#3e4650" metal={0.5} />)}
        {[0.34, 0.74, 1.14].map((y) => <B key={y} size={[0.7, 0.02, 1.6]} position={[0, y, 0]} color="#848c94" metal={0.7} rough={0.45} />)}
      </group>
    </group>
  );
}

/** Garment making: rows of sewing tables, a cutting table and a garment rail. */
function RmgBay() {
  const sewing = (pos: Vec3) => (
    <group position={pos}>
      <B size={[1.2, 0.04, 0.6]} position={[0, 0.75, 0]} color="#c9b48a" rough={0.7} />
      {[[-0.55, -0.25], [0.55, -0.25], [-0.55, 0.25], [0.55, 0.25]].map(([x, z]) => <B key={`${x}${z}`} size={[0.04, 0.75, 0.04]} position={[x!, 0.375, z!]} color="#5b6670" metal={0.6} />)}
      <B size={[0.5, 0.06, 0.18]} position={[0, 0.8, 0]} color="#e9e7e1" metal={0.2} rough={0.4} />
      <B size={[0.12, 0.26, 0.14]} position={[0.18, 0.95, -0.01]} color="#e9e7e1" metal={0.2} rough={0.4} />
      <B size={[0.42, 0.08, 0.1]} position={[-0.02, 1.08, -0.01]} color="#e9e7e1" metal={0.2} rough={0.4} />
      <C r={0.06} h={0.03} position={[0.27, 1.05, -0.01]} rotation={[0, 0, Math.PI / 2]} color="#2b2f36" />
      <B size={[0.4, 0.04, 0.4]} position={[0, 0.45, 0.55]} color="#2b2f36" />
    </group>
  );
  return (
    <group>
      {[-9, -7.4, -5.8].map((x) => [-6, -4.4].map((z) => <group key={`${x}${z}`}>{sewing([x, 0, z])}</group>))}
      {[6, 7.6, 9.2].map((x) => <group key={x}>{sewing([x, 0, -6])}</group>)}
      {/* Cutting table with a fabric roll */}
      <group position={[8, 0, 2]}>
        <B size={[1.4, 0.05, 3.6]} position={[0, 0.9, 0]} color="#f1efe9" rough={0.6} />
        <B size={[1.3, 0.85, 3.4]} position={[0, 0.45, 0]} color="#59616a" metal={0.4} />
        <C r={0.15} h={1.3} position={[0, 1.08, -1.5]} rotation={[0, 0, Math.PI / 2]} color="#2f5f93" rough={0.9} />
        <B size={[1.2, 0.01, 2.6]} position={[0, 0.93, 0.2]} color="#2f5f93" rough={0.9} />
      </group>
      {/* Garment rail */}
      <group position={[-10.5, 0, 3]}>
        <C r={0.02} h={2.0} position={[0, 1.7, 0]} rotation={[Math.PI / 2, 0, 0]} color="#9aa5b0" metal={0.9} rough={0.2} />
        {[-0.95, 0.95].map((z) => <B key={z} size={[0.04, 1.7, 0.04]} position={[0, 0.85, z]} color="#9aa5b0" metal={0.9} />)}
        {Array.from({ length: 9 }, (_, i) => <B key={i} size={[0.5, 0.75, 0.04]} position={[0, 1.3, -0.8 + i * 0.2]} rotation={[0, Math.PI / 2, 0]} color={['#c2417a', '#2f5f93', '#e9e4d6'][i % 3]!} rough={0.9} />)}
      </group>
    </group>
  );
}

/** Industrial maintenance: a gearbox rig, a hydraulic trainer and a pipe rack. */
function EimBay() {
  return (
    <group>
      <group position={[-7.5, 0, -6]}>
        <B size={[2.4, 0.2, 1.0]} position={[0, 0.5, 0]} color="#3e4650" metal={0.5} />
        <B size={[0.6, 0.5, 0.5]} position={[-0.6, 0.85, 0]} color="#2f5f93" metal={0.3} />
        <B size={[0.7, 0.6, 0.6]} position={[0.5, 0.9, 0]} color="#3a9d5d" metal={0.3} />
        <C r={0.12} h={0.3} position={[-0.1, 0.85, 0]} rotation={[0, 0, Math.PI / 2]} color="#f2c230" />
        {[-1, 1].map((x) => <B key={x} size={[0.1, 0.4, 0.8]} position={[x, 0.2, 0]} color="#3e4650" metal={0.5} />)}
      </group>
      {/* Hydraulic trainer panel */}
      <group position={[7.5, 0, -6.5]}>
        <B size={[2.2, 1.6, 0.06]} position={[0, 1.4, 0]} color="#d5d8d6" rough={0.6} />
        <B size={[2.2, 0.6, 0.8]} position={[0, 0.3, 0.3]} color="#2f5f93" metal={0.3} />
        {[-0.7, -0.2, 0.3, 0.8].map((x) => <B key={x} size={[0.18, 0.24, 0.1]} position={[x, 1.5, 0.08]} color="#3e4650" metal={0.5} />)}
        {[-0.5, 0.5].map((x) => <C key={x} r={0.06} h={0.6} position={[x, 1.0, 0.1]} rotation={[0, 0, Math.PI / 2]} color="#c8312b" metal={0.5} />)}
      </group>
      <group position={[10.3, 0, 2]}>
        {[0.5, 1.1, 1.7].map((y) => <B key={y} size={[0.6, 0.05, 2.6]} position={[0, y, 0]} color="#3e4650" metal={0.5} />)}
        {[0.58, 1.18].map((y) => [-0.18, 0.0, 0.18].map((x) => <C key={`${x}${y}`} r={0.05} h={2.4} position={[x, y, 0]} rotation={[Math.PI / 2, 0, 0]} color="#7d8790" metal={0.6} rough={0.4} />))}
      </group>
    </group>
  );
}

/** Printing: a guillotine, a digital press and paper pallets. */
function PrtBay() {
  return (
    <group>
      <group position={[-7.5, 0, -6]}>
        <B size={[1.6, 0.9, 1.2]} position={[0, 0.45, 0]} color="#d5d8d6" metal={0.3} />
        <B size={[1.6, 0.06, 1.6]} position={[0, 0.93, 0.1]} color="#9aa5b0" metal={0.8} rough={0.3} />
        <B size={[1.7, 0.7, 0.4]} position={[0, 1.5, -0.4]} color="#d5d8d6" metal={0.3} />
        <B size={[1.6, 0.08, 0.06]} position={[0, 1.12, -0.18]} color="#c8312b" />
        <B size={[0.04, 0.6, 0.04]} position={[-0.85, 1.25, 0.35]} color="#f2c230" />
        <B size={[0.04, 0.6, 0.04]} position={[0.85, 1.25, 0.35]} color="#f2c230" />
      </group>
      <group position={[7.5, 0, -6.5]}>
        <B size={[2.6, 1.2, 1.0]} position={[0, 0.6, 0]} color="#eceef1" metal={0.2} rough={0.4} />
        <B size={[0.6, 0.4, 0.8]} position={[1.6, 0.4, 0]} color="#eceef1" metal={0.2} rough={0.4} />
        <B size={[0.4, 0.26, 0.02]} position={[-0.8, 1.0, 0.51]} color="#0c2b3f" emissive="#1b6fa8" glow={0.8} cast={false} />
      </group>
      {[[9.5, 1.5], [9.5, 3.4]].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x!, 0, z!]}>
          <B size={[1.2, 0.14, 1.0]} position={[0, 0.07, 0]} color="#a8743f" rough={0.9} />
          <B size={[1.1, 0.7, 0.8]} position={[0, 0.5, 0]} color="#f7f5ef" rough={0.9} />
        </group>
      ))}
    </group>
  );
}

/** Applied AI & industrial technology: a robot cell, a PLC rack and a server cabinet. */
function AitBay() {
  return (
    <group>
      <group position={[-7.5, 0, -6]}>
        <B size={[0.6, 0.6, 0.6]} position={[0, 0.3, 0]} color="#f06721" metal={0.3} />
        <C r={0.2} h={0.4} position={[0, 0.8, 0]} color="#f06721" metal={0.3} />
        <B size={[0.18, 1.0, 0.18]} position={[0, 1.4, 0.15]} rotation={[0.4, 0, 0]} color="#f06721" metal={0.3} />
        <B size={[0.14, 0.8, 0.14]} position={[0, 1.9, 0.7]} rotation={[1.4, 0, 0]} color="#f06721" metal={0.3} />
        {[[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]].map(([x, z]) => <B key={`${x}${z}`} size={[0.05, 2.0, 0.05]} position={[x!, 1.0, z!]} color="#f2c230" />)}
        <B size={[2.8, 1.6, 0.02]} position={[0, 0.9, -1.4]} color="#9fd3ff" opacity={0.25} rough={0.05} />
      </group>
      <group position={[7.5, 0, -6.6]}>
        <B size={[1.8, 1.4, 0.4]} position={[0, 1.2, 0]} color="#d5d8d6" rough={0.6} />
        {[-0.6, -0.3, 0, 0.3, 0.6].map((x) => <B key={x} size={[0.22, 0.3, 0.1]} position={[x, 1.35, 0.22]} color="#2f9e57" />)}
        <B size={[0.5, 0.3, 0.02]} position={[0, 0.8, 0.21]} color="#0c2b3f" emissive="#1b6fa8" glow={0.8} cast={false} />
      </group>
      <group position={[10.3, 0, 2.5]}>
        <B size={[0.7, 2.0, 0.9]} position={[0, 1.0, 0]} color="#22262b" metal={0.3} />
        {Array.from({ length: 8 }, (_, i) => <B key={i} size={[0.02, 0.02, 0.02]} position={[-0.36, 0.5 + i * 0.18, 0.3]} color="#2fff80" emissive="#2fff80" glow={1} cast={false} />)}
      </group>
    </group>
  );
}

/** Electronics benches: scopes, supplies, soldering stations (IEL) or TVs and rework stations (AVE). */
function BenchBay({ kind }: { kind: 'iel' | 'ave' }) {
  const bench = (pos: Vec3, i: number) => (
    <group key={i} position={pos}>
      <B size={[1.6, 0.04, 0.75]} position={[0, 0.9, 0]} color="#3d6f8f" rough={0.7} />
      {[[-0.75, -0.33], [0.75, -0.33], [-0.75, 0.33], [0.75, 0.33]].map(([x, z]) => <B key={`${x}${z}`} size={[0.05, 0.9, 0.05]} position={[x!, 0.45, z!]} color="#5b6670" metal={0.6} />)}
      <B size={[1.6, 0.5, 0.04]} position={[0, 1.2, -0.36]} color="#d5d8d6" rough={0.6} />
      {kind === 'iel' ? <>
        <B size={[0.36, 0.2, 0.16]} position={[-0.45, 1.02, -0.2]} color="#e9ecef" metal={0.2} />
        <B size={[0.2, 0.13, 0.01]} position={[-0.5, 1.03, -0.115]} color="#0c2b3f" emissive="#2fbf6a" glow={0.6} cast={false} />
        <B size={[0.26, 0.12, 0.18]} position={[0.05, 0.98, -0.2]} color="#2b2f36" />
        <C r={0.05} h={0.04} position={[0.5, 0.94, 0]} color="#2b2f36" />
      </> : <>
        <B size={[1.0, 0.03, 0.6]} position={[0, 0.94, 0.02]} color="#14171b" rough={0.3} />
        <B size={[0.22, 0.12, 0.18]} position={[0.62, 0.98, -0.2]} color="#c8312b" metal={0.2} />
      </>}
    </group>
  );
  return (
    <group>
      {[[-8.5, 0, -6], [-6.6, 0, -6], [6.6, 0, -6], [8.5, 0, -6], [-9, 0, 2], [9, 0, 2]].map((p, i) => bench(p as Vec3, i))}
    </group>
  );
}

/** Network lab: racks with blinking switches and a row of PCs. */
function CsnBay() {
  return (
    <group>
      {[-9, -8.2, 8.2, 9].map((x, i) => (
        <group key={i} position={[x, 0, -6.4]}>
          <B size={[0.6, 2.0, 0.8]} position={[0, 1.0, 0]} color="#1f2328" metal={0.4} />
          {Array.from({ length: 10 }, (_, k) => <B key={k} size={[0.5, 0.02, 0.01]} position={[0, 0.35 + k * 0.15, 0.41]} color="#2fff80" emissive="#2fff80" glow={0.6 + (k % 3) * 0.2} cast={false} />)}
        </group>
      ))}
      {[-8, -6.5, 6.5, 8].map((x) => (
        <group key={x} position={[x, 0, 2.5]}>
          <B size={[1.2, 0.04, 0.6]} position={[0, 0.75, 0]} color="#c9b48a" rough={0.7} />
          <B size={[0.5, 0.32, 0.03]} position={[0, 1.0, -0.15]} color="#14171b" emissive="#1b6fa8" glow={0.4} />
          <B size={[0.18, 0.4, 0.4]} position={[0.45, 0.2, 0]} color="#2b2f36" />
        </group>
      ))}
    </group>
  );
}

/** RAC workshop: domestic fridges, a cold-room panel and refrigerant cylinders. */
function RacBay() {
  return (
    <group>
      {[-9, -8.1, -7.2].map((x) => (
        <group key={x} position={[x, 0, -6.3]}>
          <B size={[0.6, 1.7, 0.6]} position={[0, 0.85, 0]} color="#eef1f3" metal={0.2} rough={0.4} />
          <B size={[0.02, 0.3, 0.02]} position={[0.25, 1.2, 0.31]} color="#9aa5b0" metal={0.8} />
        </group>
      ))}
      <group position={[8, 0, -6.4]}>
        <B size={[3, 2.4, 0.12]} position={[0, 1.2, 0]} color="#d9dee3" metal={0.3} />
        <B size={[0.9, 2.0, 0.04]} position={[-0.6, 1.0, 0.08]} color="#c3cbd3" metal={0.5} />
      </group>
      {[[-10, 2], [-10, 2.5], [-9.5, 2.25]].map(([x, z], i) => (
        <group key={i} position={[x!, 0, z!]}>
          <C r={0.13} h={0.5} position={[0, 0.25, 0]} color={['#2f9e57', '#9aa5b0', '#5ab0e8'][i]!} metal={0.4} />
          <C r={0.05} h={0.08} position={[0, 0.54, 0]} color="#9aa5b0" metal={0.8} />
        </group>
      ))}
    </group>
  );
}

/** Appliance workshop: fridges, cookers and small appliances on shelves. */
function HamBay() {
  return (
    <group>
      {[-9, -8.2, -7.4, 7.4, 8.2, 9].map((x, i) => (
        <group key={x} position={[x, 0, -6.3]}>
          <B size={[0.6, i % 2 ? 0.85 : 1.6, 0.6]} position={[0, i % 2 ? 0.425 : 0.8, 0]} color={i % 3 === 2 ? '#9aa5b0' : '#eef1f3'} metal={0.3} rough={0.4} />
          {i % 2 ? <C r={0.18} h={0.02} position={[0, 0.5, 0.31]} rotation={[Math.PI / 2, 0, 0]} color="#2b2f36" /> : null}
        </group>
      ))}
      <group position={[-10, 0, 2.5]}>
        {[0.5, 1.1, 1.7].map((y) => <B key={y} size={[0.5, 0.03, 2]} position={[0, y, 0]} color="#5b6670" metal={0.5} />)}
        {[-0.7, -0.2, 0.3, 0.7].map((z, k) => <B key={z} size={[0.25, 0.25, 0.25]} position={[0, 0.65 + (k % 3) * 0.6, z]} color={['#c8312b', '#2f5f93', '#e9ecef', '#f2c230'][k]!} />)}
      </group>
    </group>
  );
}

/** Office equipment lab: copiers, a POS counter and printers on trolleys. */
function OeqBay() {
  return (
    <group>
      {[-9, -7.8, 7.8, 9].map((x) => (
        <group key={x} position={[x, 0, -6.2]}>
          <B size={[0.7, 1.0, 0.65]} position={[0, 0.5, 0]} color="#e9ecef" metal={0.2} rough={0.4} />
          <B size={[0.7, 0.12, 0.6]} position={[0, 1.08, -0.02]} color="#d5d8d6" />
          <B size={[0.2, 0.1, 0.02]} position={[0.2, 1.0, 0.33]} color="#0c2b3f" emissive="#1b6fa8" glow={0.6} cast={false} />
        </group>
      ))}
      <group position={[-9.5, 0, 2.5]}>
        <B size={[1.8, 1.0, 0.6]} position={[0, 0.5, 0]} color="#8a6a4a" rough={0.7} />
        <B size={[0.35, 0.25, 0.3]} position={[-0.4, 1.12, 0]} color="#22262b" />
        <B size={[0.25, 0.1, 0.3]} position={[0.4, 1.05, 0]} color="#2b2f36" />
      </group>
    </group>
  );
}

/** Machines and rewinding workshop: motors on test beds, a varnish oven and a transformer trainer. */
function IemBay() {
  return (
    <group>
      {[-9, -7.4].map((x) => (
        <group key={x} position={[x, 0, -6]}>
          <B size={[1.2, 0.5, 0.7]} position={[0, 0.25, 0]} color="#3e4650" metal={0.5} />
          <C r={0.25} h={0.6} position={[0, 0.8, 0]} rotation={[0, 0, Math.PI / 2]} color="#2f5f93" metal={0.4} />
        </group>
      ))}
      <group position={[8.5, 0, -6.2]}>
        <B size={[1.4, 1.6, 1.0]} position={[0, 0.8, 0]} color="#8f9aa3" metal={0.4} />
        <B size={[1.0, 1.0, 0.02]} position={[0, 0.9, 0.51]} color="#5b6670" metal={0.5} />
        <B size={[0.2, 0.1, 0.02]} position={[0.5, 1.45, 0.52]} color="#c8312b" emissive="#ff5a3a" glow={0.6} cast={false} />
      </group>
      <group position={[-9.8, 0, 2.5]}>
        <B size={[0.8, 1.0, 0.8]} position={[0, 0.5, 0]} color="#5b6670" metal={0.4} />
        {[-0.25, 0, 0.25].map((x) => <C key={x} r={0.05} h={0.3} position={[x, 1.15, 0]} color="#c9a54a" metal={0.6} />)}
      </group>
    </group>
  );
}

const BAYS: Record<string, () => ReactNode> = {
  cnc: () => <CncBay />, auto: () => <AutoBay />, elec: () => <ElecBay />, weld: () => <WeldBay />,
  rmg: () => <RmgBay />, eim: () => <EimBay />, prt: () => <PrtBay />, ait: () => <AitBay />,
  iel: () => <BenchBay kind="iel" />, ave: () => <BenchBay kind="ave" />, csn: () => <CsnBay />, rac: () => <RacBay />,
  ham: () => <HamBay />, oeq: () => <OeqBay />, iem: () => <IemBay />,
};

// ---------------------------------------------------------------------------
// Stands, in the machine's own model units
// ---------------------------------------------------------------------------
export function MachineStand({ env }: { env: ModelEnv }) {
  const floor = env.floorY ?? -1.25;
  const red = '#b8282a';
  if (env.stand === 'engine-stand') {
    // Head-plate on the flywheel end, post and an H-frame on castors.
    const post = 1.75;
    return (
      <group>
        <C r={0.4} h={0.06} position={[1.42, -0.35, 0]} rotation={[0, 0, Math.PI / 2]} color={red} metal={0.4} rough={0.4} />
        <C r={0.09} h={0.4} position={[1.62, -0.35, 0]} rotation={[0, 0, Math.PI / 2]} color={red} metal={0.4} rough={0.4} />
        <B size={[0.2, -0.35 - floor, 0.2]} position={[post, (floor - 0.35) / 2, 0]} color={red} metal={0.4} rough={0.4} />
        <B size={[0.18, 0.14, 2.6]} position={[post, floor + 0.2, 0]} color={red} metal={0.4} rough={0.4} />
        <B size={[2.8, 0.14, 0.18]} position={[post - 1.3, floor + 0.2, 0]} color={red} metal={0.4} rough={0.4} />
        {[[post, 1.25], [post, -1.25], [post - 2.6, 0]].map(([x, z]) => (
          <group key={`${x}${z}`} position={[x!, floor + 0.09, z!]}>
            <C r={0.09} h={0.08} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} color="#1b1d20" />
          </group>
        ))}
        {/* Battery tray */}
        <B size={[0.62, 0.05, 0.8]} position={[2.2, -1.03, 0.3]} color="#3e4650" metal={0.5} />
        <B size={[0.08, -1.03 - floor, 0.08]} position={[2.2, (floor - 1.03) / 2, 0.3]} color="#3e4650" metal={0.5} />
        <B size={[0.7, 0.05, 0.9]} position={[2.2, floor + 0.03, 0.3]} color="#3e4650" metal={0.5} />
      </group>
    );
  }
  if (env.stand === 'wall') {
    // A training wall board the panel is mounted on, with a cable tray.
    return (
      <group>
        <B size={[6.4, 2.3 - floor, 0.08]} position={[0, (2.3 + floor) / 2, -0.42]} color="#dfe3e6" rough={0.7} />
        <B size={[6.4, 0.18, 0.4]} position={[0, 1.7, -0.2]} color="#9ea7ae" metal={0.4} />
        <B size={[0.16, 2.3 - floor, 0.16]} position={[-3.3, (2.3 + floor) / 2, -0.38]} color="#3e4650" metal={0.5} />
        <B size={[0.16, 2.3 - floor, 0.16]} position={[3.3, (2.3 + floor) / 2, -0.38]} color="#3e4650" metal={0.5} />
        <B size={[0.14, 1.7 - 1.1, 0.14]} position={[0, 1.4, -0.3]} color="#3a3f45" />
      </group>
    );
  }
  if (env.stand === 'bench') {
    // A workbench whose top is just under the model's origin, with an ESD mat.
    const top = -0.03;
    const u = env.unitsPerM;
    return (
      <group>
        <B size={[1.9 * u, 0.04 * u, 0.85 * u]} position={[0, top - 0.02 * u, 0]} color="#c9b48a" rough={0.7} />
        <B size={[1.7 * u, 0.006 * u, 0.6 * u]} position={[0, top + 0.004 * u, 0.05 * u]} color="#3d6f8f" rough={0.8} />
        {[[-0.88, -0.36], [0.88, -0.36], [-0.88, 0.36], [0.88, 0.36]].map(([x, z]) => (
          <B key={`${x}${z}`} size={[0.05 * u, top - floor, 0.05 * u]} position={[x! * u, (top + floor) / 2, z! * u]} color="#5b6670" metal={0.6} />
        ))}
        <B size={[1.8 * u, 0.03 * u, 0.7 * u]} position={[0, floor + 0.15 * u, 0]} color="#5b6670" metal={0.5} />
      </group>
    );
  }
  if (env.stand === 'skid') {
    return (
      <group>
        {[-0.55, 0.55].map((z) => <B key={z} size={[2.4, 0.22, 0.12]} position={[0, floor + 0.11, z]} color="#3e4650" metal={0.5} rough={0.4} />)}
        {[-1.0, 1.0].map((x) => <B key={x} size={[0.12, 0.22, 1.22]} position={[x, floor + 0.11, 0]} color="#3e4650" metal={0.5} rough={0.4} />)}
      </group>
    );
  }
  return null;
}

/** Bounding rectangle of the machine in metres (relative to the workshop origin). */
export function zoneOf(box: Rect | null, env: ModelEnv): Rect {
  const u = env.unitsPerM;
  const b = box ?? { minX: -1.5, maxX: 1.5, minZ: -1, maxZ: 1 };
  const m = 0.8;
  return { minX: b.minX / u - m, maxX: b.maxX / u + m, minZ: b.minZ / u - (env.stand === 'wall' ? 0.1 : m), maxZ: b.maxZ / u + m };
}

/** The workshop around the machine, in the machine's model space. */
export function Workshop({ env, lang, box }: { env: ModelEnv; lang: Lang; box: Rect | null }) {
  const u = env.unitsPerM;
  const floor = env.floorY ?? -1.25;
  const ppe = env.stations.find((s) => s.id === 'ppe');
  const zone = zoneOf(box, env);
  const bay = env.bay ?? 'cnc';
  return (
    <group>
      <group position={[0, floor, 0]} scale={u}>
        <Room lang={lang} />
        <FloorMarks zone={zone} />
        <BenchAndTools lang={lang} />
        <SafetyPoint lang={lang} />
        {BAYS[bay]?.()}
        {ppe && (
          <group position={[ppe.pos[0] / u + Math.sin(ppe.face) * 0.55, 0, ppe.pos[1] / u + Math.cos(ppe.face) * 0.55]} rotation={[0, ppe.face + Math.PI, 0]}>
            <PpeStation lang={lang} trade={bay} />
          </group>
        )}
        <hemisphereLight args={['#fff4e0', '#4a4f55', 0.35]} />
      </group>
      <MachineStand env={env} />
    </group>
  );
}

/** Light panels the metal reflects (no HDR download). */
export function ShopLighting({ studio = false }: { studio?: boolean }) {
  return (
    <Environment resolution={256} frames={1}>
      <color attach="background" args={[studio ? '#20262e' : '#3a3f45']} />
      {[-6, -2, 2, 6].map((z) => (
        <Lightformer key={z} form="rect" intensity={studio ? 2.2 : 3} position={[0, 7, z]} rotation-x={Math.PI / 2} scale={[14, 0.8, 1]} color="#fff6e6" />
      ))}
      <Lightformer form="rect" intensity={studio ? 1.5 : 2.4} position={[-12, 4, 0]} rotation-y={Math.PI / 2} scale={[18, 2.5, 1]} color="#dcefff" />
      <Lightformer form="rect" intensity={0.8} position={[12, 3, 0]} rotation-y={-Math.PI / 2} scale={[18, 3, 1]} color="#ffe2c4" />
      <Lightformer form="ring" intensity={1.2} position={[0, -4, 0]} rotation-x={-Math.PI / 2} scale={8} color="#6b737c" />
    </Environment>
  );
}
