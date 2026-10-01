// 3MF (multi-colour, slicer-ready) and STL writers.

import type { MeshPart } from './types';
import { createZip } from './zip';

const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const num = (v: number) => {
  const r = Math.round(v * 10000) / 10000;
  return Object.is(r, -0) ? '0' : String(r);
};

/**
 * One 3MF object per colour, grouped under a single assembly object so a
 * slicer opens the file as one model made of N coloured parts.
 *
 * - Colours are declared as core-spec base materials (display colours).
 * - Metadata/model_settings.config assigns filament slot N to part N, the
 *   format Bambu Studio and OrcaSlicer read. PrusaSlicer loads the same file
 *   as one object with N parts; assign extruders there by right-clicking.
 */
export function build3mf(parts: MeshPart[], name: string): Uint8Array {
  const assemblyId = parts.length + 2;
  // One filament slot per material, numbered in order of first appearance.
  const materials: MeshPart[] = [];
  const slot = parts.map((p) => {
    let k = materials.findIndex((m) => m.material === p.material);
    if (k < 0) k = materials.push(p) - 1;
    return k;
  });
  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>');
  out.push(
    '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">',
  );
  out.push(`<metadata name="Title">${xmlEscape(name)}</metadata>`);
  out.push('<metadata name="Application">Skale Club 3D Vectorizer</metadata>');
  out.push('<resources>');
  out.push('<basematerials id="1">');
  for (const p of materials) out.push(`<base name="${xmlEscape(p.name)}" displaycolor="${p.color.toUpperCase()}FF"/>`);
  out.push('</basematerials>');
  parts.forEach((p, k) => {
    const id = k + 2;
    out.push(`<object id="${id}" name="${xmlEscape(p.name)}" type="model" pid="1" pindex="${slot[k]}">`);
    out.push('<mesh><vertices>');
    const v = p.positions;
    const lines: string[] = [];
    for (let i = 0; i < v.length; i += 3) lines.push(`<vertex x="${num(v[i])}" y="${num(v[i + 1])}" z="${num(v[i + 2])}"/>`);
    out.push(lines.join(''));
    out.push('</vertices><triangles>');
    const t = p.indices;
    const tris: string[] = [];
    for (let i = 0; i < t.length; i += 3) tris.push(`<triangle v1="${t[i]}" v2="${t[i + 1]}" v3="${t[i + 2]}"/>`);
    out.push(tris.join(''));
    out.push('</triangles></mesh></object>');
  });
  out.push(`<object id="${assemblyId}" name="${xmlEscape(name)}" type="model"><components>`);
  parts.forEach((_, k) => out.push(`<component objectid="${k + 2}"/>`));
  out.push('</components></object>');
  out.push('</resources>');
  out.push(`<build><item objectid="${assemblyId}"/></build>`);
  out.push('</model>');

  const settings: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', '<config>'];
  settings.push(`  <object id="${assemblyId}">`);
  settings.push(`    <metadata key="name" value="${xmlEscape(name)}"/>`);
  settings.push('    <metadata key="extruder" value="1"/>');
  parts.forEach((p, k) => {
    settings.push(`    <part id="${k + 2}" subtype="normal_part">`);
    settings.push(`      <metadata key="name" value="${xmlEscape(p.name)}"/>`);
    settings.push('      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>');
    settings.push(`      <metadata key="extruder" value="${slot[k] + 1}"/>`);
    settings.push('    </part>');
  });
  settings.push('  </object>');
  settings.push('</config>');

  return createZip([
    {
      name: '[Content_Types].xml',
      data:
        '<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>' +
        '<Default Extension="config" ContentType="text/xml"/>' +
        '</Types>',
    },
    {
      name: '_rels/.rels',
      data:
        '<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>' +
        '</Relationships>',
    },
    { name: '3D/3dmodel.model', data: out.join('\n') },
    { name: 'Metadata/model_settings.config', data: settings.join('\n') },
  ]);
}

/** Binary STL of one part. */
export function buildStl(part: MeshPart): Uint8Array {
  const t = part.indices;
  const v = part.positions;
  const count = t.length / 3;
  const out = new Uint8Array(84 + count * 50);
  const view = new DataView(out.buffer);
  const header = new TextEncoder().encode(`Skale Club 3D Vectorizer: ${part.name}`.slice(0, 79));
  out.set(header, 0);
  view.setUint32(80, count, true);
  let p = 84;
  for (let i = 0; i < t.length; i += 3) {
    const a = t[i] * 3, b = t[i + 1] * 3, c = t[i + 2] * 3;
    const ux = v[b] - v[a], uy = v[b + 1] - v[a + 1], uz = v[b + 2] - v[a + 2];
    const wx = v[c] - v[a], wy = v[c + 1] - v[a + 1], wz = v[c + 2] - v[a + 2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    view.setFloat32(p, nx, true);
    view.setFloat32(p + 4, ny, true);
    view.setFloat32(p + 8, nz, true);
    p += 12;
    for (const idx of [a, b, c]) {
      view.setFloat32(p, v[idx], true);
      view.setFloat32(p + 4, v[idx + 1], true);
      view.setFloat32(p + 8, v[idx + 2], true);
      p += 12;
    }
    view.setUint16(p, 0, true);
    p += 2;
  }
  return out;
}

/** Signed volume of a closed mesh (mm³). */
export function meshVolume(positions: Float32Array, indices: Uint32Array): number {
  let vol = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    vol +=
      positions[a] * (positions[b + 1] * positions[c + 2] - positions[b + 2] * positions[c + 1]) -
      positions[a + 1] * (positions[b] * positions[c + 2] - positions[b + 2] * positions[c]) +
      positions[a + 2] * (positions[b] * positions[c + 1] - positions[b + 1] * positions[c]);
  }
  return vol / 6;
}
