// Export dei modelli: STL binario (tutti i pezzi uniti) e 3MF multi-oggetto
// (un oggetto per pezzo, con colore), che Bambu Studio / PrusaSlicer / Orca aprono
// come parti già assegnate ai filamenti in base al colore.

import { zipSync, strToU8 } from 'fflate';
import type { Part } from '@bdl/geometry';

export function toSTL(parts: readonly Part[], header = 'bettadesignlab'): Uint8Array {
  const triCount = parts.reduce((n, p) => n + p.mesh.indices.length / 3, 0);
  const buf = new ArrayBuffer(84 + triCount * 50);
  const dv = new DataView(buf);
  const head = strToU8(header).slice(0, 79);
  new Uint8Array(buf, 0, 80).set(head);
  dv.setUint32(80, triCount, true);
  let o = 84;
  for (const p of parts) {
    const { positions: v, indices: f } = p.mesh;
    for (let t = 0; t < f.length; t += 3) {
      const a = f[t] * 3, b = f[t + 1] * 3, c = f[t + 2] * 3;
      const ux = v[b] - v[a], uy = v[b + 1] - v[a + 1], uz = v[b + 2] - v[a + 2];
      const wx = v[c] - v[a], wy = v[c + 1] - v[a + 1], wz = v[c + 2] - v[a + 2];
      let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;
      for (const val of [nx, ny, nz]) { dv.setFloat32(o, val, true); o += 4; }
      for (const i of [a, b, c]) {
        dv.setFloat32(o, v[i], true);
        dv.setFloat32(o + 4, v[i + 1], true);
        dv.setFloat32(o + 8, v[i + 2], true);
        o += 12;
      }
      dv.setUint16(o, 0, true);
      o += 2;
    }
  }
  return new Uint8Array(buf);
}

const esc = (s: string) => s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
const num = (x: number) => (Math.round(x * 1e4) / 1e4).toString();

export interface ThreeMFOptions {
  title?: string;
  designer?: string;
  /** Sposta il modello al centro del piatto (mm). Default 128,128 (piatti 256 mm). */
  plateCenter?: [number, number];
}

export function to3MF(parts: readonly Part[], opts: ThreeMFOptions = {}): Uint8Array {
  const [cx, cy] = opts.plateCenter ?? [128, 128];
  const live = parts.filter((p) => p.mesh.indices.length > 0);
  const palette = [...new Set(live.map(p => p.color.toUpperCase()))];
  const colorGroupId = live.length + 3;
  const materials = `<m:colorgroup id="${colorGroupId}">${palette.map(color => `<m:color color="${color}FF"/>`).join('')}</m:colorgroup>`;

  const objects = live
    .map((p, i) => {
      const { positions: v, indices: f } = p.mesh;
      const verts: string[] = [];
      for (let k = 0; k < v.length; k += 3) {
        verts.push(`<vertex x="${num(v[k])}" y="${num(v[k + 1])}" z="${num(v[k + 2])}"/>`);
      }
      const tris: string[] = [];
      for (let k = 0; k < f.length; k += 3) {
        tris.push(`<triangle v1="${f[k]}" v2="${f[k + 1]}" v3="${f[k + 2]}"/>`);
      }
      return `<object id="${i + 2}" name="${esc(p.name)}" type="model" pid="${colorGroupId}" pindex="${palette.indexOf(p.color.toUpperCase())}"><mesh><vertices>${verts.join('')}</vertices><triangles>${tris.join('')}</triangles></mesh></object>`;
    })
    .join('');

  // Un oggetto "assemblato" che raggruppa i pezzi: gli slicer lo caricano come un unico
  // modello multi-parte già posizionato, invece di sparpagliare i pezzi sul piatto.
  const asmId = live.length + 2;
  const components = live.map((_, i) => `<component objectid="${i + 2}"/>`).join('');
  const assembly = `<object id="${asmId}" name="${esc(opts.title ?? 'model')}" type="model"><components>${components}</components></object>`;

  const meta = [
    ['Title', opts.title ?? 'bettadesignlab model'],
    ['Designer', opts.designer ?? 'bettadesignlab'],
    // Modello standard: non presentarlo come un progetto con preset Bambu.
    ['Application', 'bettadesignlab'],
    ['Generator', 'bettadesignlab'],
    ['BambuStudio:3mfVersion', '1'],
    ['CreationDate', new Date().toISOString().slice(0, 10)],
  ]
    .map(([k, val]) => `<metadata name="${k}">${esc(val)}</metadata>`)
    .join('');

  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="it-IT" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02" requiredextensions="m">${meta}<resources>${materials}${objects}${assembly}</resources><build><item objectid="${asmId}" transform="1 0 0 0 1 0 0 0 1 ${cx} ${cy} 0"/></build></model>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`;

  // Le proprietà colore standard non bastano a Bambu/Orca: ogni volume deve
  // avere un extruder 1-based e la palette va dichiarata nel progetto.
  // Nessun collegamento AMS né preset specifico della stampante del cliente.
  const partSettings = live.map((p, i) => `<part id="${i + 2}" subtype="normal_part"><metadata key="name" value="${esc(p.name)}"/><metadata key="extruder" value="${palette.indexOf(p.color.toUpperCase()) + 1}"/><metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/></part>`).join('');
  const modelSettings = `<?xml version="1.0" encoding="UTF-8"?><config><object id="${asmId}"><metadata key="name" value="${esc(opts.title ?? 'model')}"/><metadata key="extruder" value="1"/>${partSettings}</object><plate><metadata key="plater_id" value="1"/><model_instance><metadata key="object_id" value="${asmId}"/><metadata key="instance_id" value="0"/><metadata key="identify_id" value="1"/></model_instance></plate></config>`;
  return zipSync({
    'Metadata/model_settings.config': strToU8(modelSettings),
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(rels),
    '3D/3dmodel.model': strToU8(model),
  });
}

/** Avvia il download di un file nel browser. */
export function download(data: Uint8Array, filename: string, mime = 'application/octet-stream'): void {
  const blob = new Blob([data as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Nome file sicuro: "Sottobicchiere esagonale" → "sottobicchiere-esagonale". */
export function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'model';
}
