# Muscle Atlas 3D — attribution and modifications

Model source: https://github.com/zhangguanghao523/muscle-atlas-3d

Pinned source revision: `6eaa98df6d36d5cd7ad6f29761926dbacd231b60`.

Underlying anatomy models: **BodyParts3D, © The Database Center for Life Science (DBCLS)**.
License: **Creative Commons Attribution-ShareAlike 2.1 Japan**:
https://creativecommons.org/licenses/by-sa/2.1/jp/

The source OBJ file headers identify BodyParts3D and this license. The upstream README is preserved in `UPSTREAM_README.md`.
The adapted model `atlas.glb` and adapted anatomy catalog are distributed under the same CC BY-SA 2.1 Japan license. No endorsement by the original authors is implied.

Modifications in this project:

- Converted the 492 OBJ structures (254 muscles, 238 bones) into a local GLB asset.
- Converted millimetres/Z-up to metres/Y-up. Preserved vertex positions after this coordinate conversion, structure IDs, and individual left/right structures.
- Merged coincident vertices for smooth normal shading; did not sculpt, inflate, remesh, or add skin.
- Replaced materials with deterministic muscle-family colors and ivory bones. Colors distinguish structures; they are not trigger-point annotations.
- Converted Chinese labels to Traditional Chinese, preserving original English labels and FJ IDs.
- Added runtime selection, visibility, opacity, and exploded-view controls. Explosion moves muscles temporarily and leaves bones in place.

`catalog.json` records the source revision, source OBJ SHA-256 hashes, and export details. The upstream application JavaScript, exercise descriptions, and medical advice are not incorporated.
