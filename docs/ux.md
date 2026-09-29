# Notes UX

Garde-fou de cohérence. Toute nouvelle interface doit s'y conformer ou le faire évoluer.

## Patterns étudiés → retenus

| Source | Pattern | Retenu parce que |
|---|---|---|
| Google Drive | Recherche centrale, chips de filtre, vues liste/grille, raccourcis clavier officiels | Référence de navigation clavier et de densité |
| Dropbox | Aperçu latéral qui garde la liste visible | Continuité spatiale |
| Notion / Raycast / Linear | Palette ⌘K : récents quand vide, résultats instantanés, actions contextuelles avec leur raccourci | Tout faire au clavier, apprendre les raccourcis en passant |
| Proton Drive | Barre latérale violet profond, contenu clair, lignes 44 px, sélection neutre, toasts inversés en bas au centre, file de transfert en bas à droite | Langage visuel calme et premium |
| Google / Proton | Suppression → toast « Annuler », pas de modale | Réversibilité |

## Langage visuel

- Barre latérale `nav` (violet profond en clair, quasi noir en sombre), contenu `canvas`. Un seul accent (`accent`, #6d4aff).
- Inter 14/20. Titres en graisse 600, jamais de texte en capitales.
- Rayons : 8 px (contrôles, lignes), 12 px (panneaux, dialogues, toasts). Ombres uniquement sur ce qui flotte (menus, dialogues, file d'upload).
- Pas de dégradés, pas de verre dépoli, pas de cartes décoratives.
- Mode sombre conçu (palette « Carbon »), jamais `invert()`.

## Comportement des fichiers

- Clic : sélectionne. Double-clic ou Entrée : dossier → ouvrir, fichier → aperçu.
- Cmd/Ctrl+clic : bascule, Maj+clic : plage, Cmd/Ctrl+A : tout.
- Clic droit sur un élément non sélectionné : il devient la sélection, puis le menu s'ouvre et agit sur la sélection. Chaque ligne a aussi un bouton `⋮`.
- La barre d'outils se transforme en barre de sélection (compteur + actions) dès qu'une sélection existe.
- Glisser des éléments sur un dossier (liste, fil d'Ariane ou « Mon Drive » dans la barre latérale) les y déplace.
- Glisser depuis une zone vide trace un rectangle de sélection, en liste comme en grille ; ⌘/Ctrl ou Maj ajoute à la sélection existante. La liste défile d'elle-même près des bords.
- Tri : dossiers toujours en premier, puis colonne choisie. Préférence mémorisée.
- Colonnes liste : Nom, Accès, Modifié, Taille (+ Dernière consultation externe en large).

## Curseurs

- Main sur tout ce qui agit au clic : fichiers, boutons, liens, éléments de menu, onglets, options.
- « Interdit » sur ce qui est désactivé.
- « Saisir » pendant l'appui sur un élément déplaçable.
- Croix fine violette (curseur sur mesure) pendant le tracé d'un rectangle de sélection ; curseur système en mode contraste forcé.

## Raccourcis

| Touche | Action |
|---|---|
| ⌘/Ctrl K | Palette de commandes |
| / | Rechercher |
| ↑ ↓ (← → en grille) | Déplacer le focus ; Maj pour étendre la sélection |
| Home / End | Premier / dernier élément |
| Entrée | Ouvrir |
| Espace | Aperçu rapide (bascule) |
| Échap | Fermer le panneau / l'aperçu / vider la sélection |
| ⌘/Ctrl A | Tout sélectionner |
| Suppr / ⌫ | Corbeille |
| F2 | Renommer |
| S | Favori (propriétaire et lecteurs, chacun les siens) |
| L | Étiquettes de la sélection |
| ⌘/Ctrl / | Aide des raccourcis |
| ← → (aperçu plein écran) | Fichier précédent / suivant |

## Aperçu

- Aperçu rapide : panneau à droite (~45 % du contenu), la liste reste visible et navigable ; ↑↓ change l'élément prévisualisé.
- Aperçu plein écran : `?preview=<id>&full=1`, navigation ← → dans le dossier. Échap ou « retour » navigateur rend la liste intacte.
- Images, PDF (pdf.js), texte, Markdown, audio, vidéo, HTML (origine isolée, iframe sandbox). Sinon : icône, « Ce fichier ne peut pas être prévisualisé », Télécharger.
- Word, Excel et PowerPoint : page convertie côté serveur, affichée comme le HTML. Un classeur montre ses feuilles l'une sous l'autre avec des onglets d'accès rapide ; une présentation montre le texte de chaque diapositive, avec la mention que la mise en page complète demande le téléchargement.
- Étiquettes : pastilles colorées après le nom, réduites à des points quand la colonne manque de place ; section « Étiquettes » dans la barre latérale, chacune menant à sa recherche ; dialogue à cases pour une sélection (case à tiret quand seule une partie la porte), création à la volée.
- Les miniatures de PDF montrent le haut de la première page, pas son centre souvent vide. Les vidéos ont une miniature prise à une seconde, la première image étant souvent noire.

## Partage

- Un seul panneau : personnes (sans sélecteur de rôle : tout le monde est lecteur), accès hérités affichés avec leur origine, lien public (désactivé / toute personne disposant du lien), téléchargement autorisé, expiration, Copier le lien.
- Ajouter quelqu'un = une adresse email. Sans compte : invitation « compte » par défaut ; « lien personnel » en option, avec la mention honnête qu'il peut être transféré.
- Les liens public/personnels ne présentent jamais le visiteur comme identifié (« Lien public », « Paul (lien personnel) »).

## Feedback

- Action courte → toast (bas centre, 4 s ; 6 s si « Annuler »). Erreur → toast qui reste plus longtemps, message humain et action quand possible. Jamais « Error 500 ».
- Confirmation modale seulement pour l'irréversible : supprimer définitivement, vider la corbeille, désactiver/supprimer une personne.
- Chargement : squelettes et mises à jour optimistes, jamais de spinner central. La navigation ne disparaît jamais.

## Mobile

- < 768 px : barre latérale en tiroir, en-tête compact avec recherche, bouton flottant « + » pour importer.
- Liste en une colonne (nom + méta sur deux lignes), menu `⋮` en feuille d'actions. L'aperçu est plein écran.
- Pages de partage public : pensées d'abord pour le téléphone (document visible sans défilement, bouton Télécharger accessible au pouce).

## États vides

Chaque vue vide explique quoi faire, en une phrase, avec l'action principale (Importer, Nouveau dossier, retirer des filtres…).
