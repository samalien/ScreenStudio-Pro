# Module Effets visuels — ScreenStudio Pro v0.7.1

## Pipeline de rendu

```
Clip.effects + keyframes
        ↓ resolvedEffects()  (interpolation + easing)
        ↓ draw transform (scale, rotation, crop, PiP, blur, shadow)
        ↓ applyPostFx()
            · color grade (brightness, contrast, sat, exposure, temp, tint, shadows, highlights)
            · sharpen / edge
            · glitch / distortion
            · mosaic
            · glow
            · vignette
            · mask (circle / rect)
```

Même pipeline pour **preview live** (`TimelineEngine`) et **export** (`exportTimeline.ts`).

## Bibliothèque

`engine/effectsLibrary.ts` — presets organisés :

- Filtres : Cinématique, Vintage, N&B, Rétro, Chaud, Froid, Portrait, Paysage, Fade, Vif
- Couleur : ombres, noirs, teal-orange
- Flou, stylisation (glitch, contours, netteté, ombre)
- Lumière (glow, bloom, vignette)
- Distorsion, masques
- Animations entrée/sortie (keyframes opacity / scale / position)

## Persistance

Tous les champs `ClipEffects` + `keyframes[]` sont sérialisés dans `.ssproj` via `toDocument()`.

## UI

- Panneau **Effets** (sidebar) : grille de presets
- Propriétés timeline : sliders grade + glitch + glow + transform
