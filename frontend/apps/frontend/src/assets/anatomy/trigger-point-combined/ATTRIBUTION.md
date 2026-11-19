# Combined muscle atlas — sources and modifications

This derived asset combines two attributed anatomy sources. Original assets are retained unchanged.

## muscle-atlas-3d component

- https://github.com/zhangguanghao523/muscle-atlas-3d
- Revision: `6eaa98df6d36d5cd7ad6f29761926dbacd231b60`.
- BodyParts3D, © The Database Center for Life Science (DBCLS), original model by Kousaku Okubo.
- CC BY-SA 2.1 Japan: https://creativecommons.org/licenses/by-sa/2.1/jp/
- Original FJ IDs and geometry are preserved; labels, classification, materials and display metadata are adapted.
- See `../muscle-atlas-3d/ATTRIBUTION.md` and `../muscle-atlas-3d/UPSTREAM_README.md` for component notices.

## trigger-point / Z-Anatomy component

- Input: the user's `Paper/trigger-point/src/assets/Z-Anatomy_Muscles_Interactive_Zones.glb`.
- Z-Anatomy — The libre 3D atlas of anatomy, CC BY-SA 4.0.
- https://github.com/Z-Anatomy/Models-of-human-anatomy
- https://creativecommons.org/licenses/by-sa/4.0/
- Z-Anatomy design, 3D and anatomy: Gauthier Kervyn. Blender add-on: Marcin Zielinski.
- Underlying BodyParts3D / DBCLS / Kousaku Okubo, CC BY-SA 2.1 Japan, as credited by Z-Anatomy.
- See `../ATTRIBUTION.md` and the upstream License.txt for full component notices.

The adapted Z-Anatomy geometry, classification and bilingual catalog retain CC BY-SA 4.0 attribution and share-alike terms. Underlying component credits and license notices remain applicable. No independent authorship or endorsement by the original authors is claimed.

## Changes

- Read the six `zoneControls` labels and exact GLB `Zone_*` memberships from trigger-point. Unassigned structures remain unassigned.
- Add missing muscles and independently selectable muscle parts from that GLB, excluding text helpers, fascia, bursae, tendons and other non-muscle additions.
- Apply source world matrices and a single translation to the added meshes. No sculpting, remeshing, stretching or rescaling is applied.
- Keep every original FJ structure. Whole-muscle structures overlapping newly added subdivisions are hidden by default but remain selectable and can be shown explicitly.
- Recolor neighbouring muscle families, preserve Traditional Chinese / English names and provide runtime explosion/opacity controls.
- This model contains no skin or trigger-point annotations. Registration is visual and approximate; source shapes and poses differ.

`catalog.json` contains input hashes, version, exact correspondences, source node IDs, registration anchors/residuals and material colors. `docs/anatomy-comparison.md` in the repository provides the complete comparison and counts.
