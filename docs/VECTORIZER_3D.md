# 3D Vectorizer

Admin → **3D Vectorizer** (`/admin/vectorizer`) turns a logo image into clean SVG
layers and a multi-color 3MF ready to slice. Everything runs in the browser, in
a Web Worker. Nothing is uploaded.

- Engine: `shared/vectorizer/` (plain TypeScript, no DOM; also runs in Node)
- UI: `client/src/components/admin/vectorizer/`
- Tests: `npx tsx --test shared/vectorizer/vectorizer.test.ts`

## Why it beats a generic tracer for printing

| Problem with typical tracers (Illustrator Image Trace, Potrace per color) | What the engine does instead |
| --- | --- |
| Anti-aliased edges add phantom shades ("asked for 3 colors, got 29") | The palette is learned only from **flat-area pixels**. Edge pixels are then explained as a **two-color mix** (gamma sRGB, premultiplied) and go to whichever color covers more than half the pixel. That places the boundary with sub-pixel precision and never invents an in-between color. |
| Colors in thin strokes (small print, hairlines) have no flat pixels and get lost or traced as blends | A second pass finds pixels that no nearby color pair explains, groups them per stroke, and recovers the stroke color. Blends of two known colors are rejected. |
| Near-black JPEG noise looks like several colors | Color distances use OKLab with Ottosson's toe (as in Okhsl), so darks are not spread out. |
| Each color is traced separately, so neighbours get gaps or overlaps (slicers then need "gap closing") | A **planar map**: every boundary between two regions is extracted once, as an edge between junction nodes, and shared by both regions. After curve fitting they still meet exactly. |
| Wobbly lines, rounded corners, too many nodes | Potrace-style corner detection (polygon offset test, cluster-aware), exact straight lines, perfect circles (Kåsa fit), least-squares Béziers (Schneider) with G1 joins, then a merge pass that fuses neighbouring curves while they stay within tolerance. |
| No idea whether it will print | Specks below a minimum area are merged into their surroundings, details thinner than the nozzle are flagged (morphological opening via an exact distance transform) and can be thickened into the background. |

## Pipeline

1. **Resample** to a working resolution (Standard / High / Ultra, up to 8× for
   small sources) with a premultiplied cubic filter.
2. **Assign colors** (`segment.ts`): core pixels by nearest color, edge pixels
   by mixture, then a 3×3 majority vote.
3. **Background** removal (everywhere, or only connected to the border).
4. **Print cleanup**: speck removal (mm²), optional thickening of thin details.
5. **Base / keychain** (`base.ts`): outline (offset), rounded rectangle,
   rectangle or circle plate and a keyring tab with a hole kept clear of the
   artwork. Done in raster space so it goes through the same exact tracer.
6. **Trace** (`planar.ts`, `fit.ts`, `outline.ts`).
7. **Output** (`pipeline.ts`): SVG in millimetres with one Inkscape layer per
   color, stacked SVG, per-color ZIP, watertight meshes (`mesh.ts`, earcut with
   T-junction repair), 3MF and STL (`export3d.ts`, `zip.ts`).

## 3D modes

- **Colors only**: each color extruded on its own (per-color height).
- **Flat inlay**: colors inlaid flush into the top of the plate.
- **Raised relief**: colors stand on the plate (per-color height).

The 3MF has one object made of N parts, one filament slot per color. Colors are
core-spec base materials; `Metadata/model_settings.config` assigns the slots
for Bambu Studio and OrcaSlicer. PrusaSlicer opens it as one object with N
parts; assign extruders there by right-clicking a part. Every part is a closed
solid — the base slab and anything on or in it are separate parts that share a
slot.
