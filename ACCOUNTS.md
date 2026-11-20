# Comptes, projets & cloud — ScreenStudio Pro

## Architecture

- **Local-first** : comptes et index projets stockés sous `userData` (JSON isolé)
- **Mots de passe** : scrypt + salt (jamais en clair)
- **Sessions** : tokens 30 jours, invalidation logout
- **Isolation** : projets filtrés par `ownerId` / `sharedWith`
- **Cloud** : interface `CloudStorageProvider` déjà définie ; prêt S3/R2

## Fonctionnalités

### Utilisateurs
Inscription, connexion, déconnexion, reset MDP (token local), profil, rôles globaux (user/pro/admin)

### Projets
Créer, index, favoris, recherche, soft-delete, restauration, dossiers, versioning meta

### Collaboration
Invitations email + rôle (owner/admin/editor/viewer/guest), commentaires, permissions

### Cloud / quotas
Quota free 2 Go / pro 50 Go, barre d’usage, modèle fichiers cloud

## Fichiers

- `src/shared/types/auth.ts`
- `src/main/services/auth/AuthService.ts`
- `src/renderer/stores/authStore.ts`
- `src/renderer/panels/AccountPanel.tsx`
- IPC `auth:*` + preload

## UI

Sidebar → **Compte**
