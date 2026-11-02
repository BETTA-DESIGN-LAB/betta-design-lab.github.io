import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { to3MF } from '@bdl/export';
import type { Part } from '@bdl/geometry';
const mesh = { positions: new Float32Array([0,0,0,1,0,0,0,1,0]), indices: new Uint32Array([0,1,2]) };
const parts = ['#ff4b16', '#ffffff', '#FF4B16'].map((color, i) => ({ id: `p${i}`, name: `Parte ${i} & "test"`, color, mesh } as Part));
const archive = unzipSync(to3MF(parts, { title: 'Colori & geometrie', plateCenter: [90,90] }));
assert.equal(archive['Metadata/project_settings.config'], undefined);
assert.equal(archive['Metadata/print_profile.config'], undefined);
assert.equal(Object.keys(archive).some(name => /(?:printer|filament|process)_settings/.test(name)), false);
const settings = strFromU8(archive['Metadata/model_settings.config']);
assert.deepEqual([...settings.matchAll(/<part id="(\d+)"[^>]*>.*?<metadata key="extruder" value="(\d+)"/g)].map(m => [m[1],m[2]]), [['2','1'],['3','2'],['4','1']]);
assert.ok(settings.includes('&#38; &#34;test&#34;'));
assert.ok(settings.includes('object_id" value="5"'));
const model = strFromU8(archive['3D/3dmodel.model']);
assert.equal((model.match(/<mesh>/g) ?? []).length, 3);
assert.equal((model.match(/<triangle /g) ?? []).length, 3);
assert.ok(model.includes('90 90 0'));
assert.ok(model.includes('<metadata name="Application">bettadesignlab</metadata>'));
assert.ok(!model.includes('BambuStudio-'));
assert.ok(model.includes('xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02"'));
assert.equal((model.match(/<m:color color=/g) ?? []).length, 2);
assert.ok(model.includes('color="#FF4B16FF"'));
assert.ok(model.includes('color="#FFFFFFFF"'));
assert.deepEqual([...model.matchAll(/<object id="[234]"[^>]*pindex="(\d+)"/g)].map(m=>m[1]), ['0','1','0']);
assert.ok(model.includes('<metadata name="Generator">bettadesignlab</metadata>'));
const mono = strFromU8(unzipSync(to3MF([parts[0]]))['3D/3dmodel.model']);
assert.equal((mono.match(/<m:color color=/g) ?? []).length, 1);
console.log('3MF: colori standard, assegnazioni e geometrie senza preset verificati');

for (const [profile, walls, infill] of [['standard','3','15%'],['mechanical','4','20%']] as const) {
  const zip = unzipSync(to3MF(parts, { printProfile: profile }));
  const config = strFromU8(zip['Metadata/model_settings.config']);
  for (const [key,value] of Object.entries({layer_height:'0.2',wall_loops:walls,sparse_infill_density:infill,sparse_infill_pattern:'gyroid',top_shell_layers:'5',bottom_shell_layers:'4'})) {
    assert.ok(config.includes(`key="${key}" value="${value}"`));
  }
  assert.ok(!/nozzle_diameter|temperature|printer_model|enable_support|support_type|filament_type/.test(config));
  assert.equal(zip['Metadata/project_settings.config'], undefined);
}
const untouched = strFromU8(unzipSync(to3MF(parts, {printProfile:false}))['Metadata/model_settings.config']);
assert.ok(!untouched.includes('layer_height'));
console.log('3MF: profili oggetto 0.20, robustezza e conservazione macchina/filamenti verificati');
