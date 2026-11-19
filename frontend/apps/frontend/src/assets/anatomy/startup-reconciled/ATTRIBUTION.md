# Startup.blend reconciled muscle atlas

Primary muscle geometry: the user's `Documents/Z-Anatomy/Startup.blend`.
SHA-256: `9f08a17ea0115fed80b2a73ecdf0a1bc2ab2f6956f37c593ce23d513ea35afcd`.

Z-Anatomy — The libre 3D atlas of anatomy — CC BY-SA 4.0:
https://github.com/Z-Anatomy/Models-of-human-anatomy
https://github.com/Z-Anatomy/Models-of-human-anatomy/blob/master/License.txt
https://creativecommons.org/licenses/by-sa/4.0/

Z-Anatomy design, 3D and anatomy: Gauthier Kervyn. Blender add-on: Marcin Zielinski.
Underlying BodyParts3D: © The Database Center for Life Science (DBCLS), original model by Kousaku Okubo; CC BY-SA 2.1 Japan as credited by Z-Anatomy.

Retained non-cranial bones and four source-only cervical muscle meshes: muscle-atlas-3d,
revision `6eaa98df6d36d5cd7ad6f29761926dbacd231b60`:
https://github.com/zhangguanghao523/muscle-atlas-3d
https://creativecommons.org/licenses/by-sa/2.1/jp/

Retained support structures and classification include derivatives from the user's
`Paper/trigger-point` GLB. Full notices are preserved in `../ATTRIBUTION.md`,
`../muscle-atlas-3d/ATTRIBUTION.md`, and `../trigger-point-combined/ATTRIBUTION.md`.
These notices and the underlying component licenses remain applicable. No endorsement is implied.

Changes: export source muscle meshes with their configured modifiers/world matrices;
exclude text helpers and unrequested non-muscle structures; include the paired epicranial aponeurosis as support structures; preserve shape while
converting Blender axes to glTF and applying one recorded translation; consolidate
same-side anatomical identities and overlapping aggregate models into Startup's
individual parts; retain old-ID aliases; add the missing right internal abdominal
oblique; distinguish tendon sheaths from muscles; preserve Chinese labels and original
trigger-point Zone membership; assign deterministic neighbouring muscle colors.

The original blend and previous assets are unchanged. Adapted Z-Anatomy muscle geometry
and bilingual classification retain CC BY-SA 4.0 attribution and share-alike terms;
underlying component notices remain applicable. This is a visual anatomy model, without
skin, trigger-point annotations or medically validated registration.

The complete provenance, input hashes, object names, changes, aliases and translation
are in `catalog.json`. See repository `docs/startup-muscle-reconciliation.md` for the audit.


The 22 mapped head bones are also exported from the same Startup.blend, retaining their FJ IDs, to correct skull occlusion of the occipitalis muscles. The remaining bone meshes are retained from muscle-atlas-3d.

## 分類與顯示範圍（2026-11-16）

保留肌筋膜與骨骼系統，原六大部位依解剖身份重新整理；原分類保存在 catalog 的 originalZones。活躍模型為 466 個肌肉、8 個筋膜相關結構與 238 個骨骼系統構件。5 個甲狀舌骨韌帶／膜物件不列入活躍資產，歷史來源未改。詳見 docs/anatomy-classification-audit.md。
