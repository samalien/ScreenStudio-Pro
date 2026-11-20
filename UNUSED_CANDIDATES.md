# Fichiers potentiellement redondants (NE PAS supprimer sans validation)

Inventaire Mission 1 — candidats uniquement, **aucune suppression effectuée**.

| Chemin | Raison du signalement |
|--------|------------------------|
| `src/renderer/modules/editor/EditorModule.tsx` | Ancien éditeur ; workspace CapCut/TimelineEngine est le chemin principal |
| `src/renderer/modules/workspace/CapCutWorkspace.tsx` | Shell workspace ; vérifier s'il est encore monté depuis App/Dashboard |
| `src/renderer/panels/GraphicsPanel.tsx` | Wrapper fin ; l'éditeur réel est `modules/graphics/GraphicsEditor.tsx` |
| Multiples `*.md` racine | Doc par feature ; README peut pointer vers un seul index |

Avant toute suppression : grep des imports + test manuel capture/timeline/export.
