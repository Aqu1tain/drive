[English](ux.md) · **Français**

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
- Site en ZIP : s'ouvre comme une page web (même bandeau, plein écran, nouvel onglet), liens relatifs et sous-dossiers compris ; le téléchargement rend l'archive d'origine.
- Word, Excel et PowerPoint : page convertie côté serveur, affichée comme le HTML. Un classeur montre ses feuilles l'une sous l'autre avec des onglets d'accès rapide ; une présentation montre le texte de chaque diapositive, avec la mention que la mise en page complète demande le téléchargement.
- Étiquettes : pastilles colorées après le nom, réduites à des points quand la colonne manque de place ; section « Étiquettes » dans la barre latérale, chacune menant à sa recherche ; dialogue à cases pour une sélection (case à tiret quand seule une partie la porte), création à la volée.
- Glisser-déposer depuis l'ordinateur, fichiers ou dossiers entiers : partout dans l'application. Dans un dossier, ils y sont importés (ou dans le sous-dossier survolé) ; ailleurs, et sur « Mon Drive » dans la barre latérale, ils vont à la racine. Un fichier lâché ne fait jamais quitter l'application au navigateur, même pour un lecteur (le dépôt lui est simplement refusé).
- En grille, un dossier montre une mosaïque de ses dernières images et vidéos (une à quatre, celles rangées directement dedans d'abord, puis celles des sous-dossiers), avec un badge de dossier pour ne pas le confondre avec une photo. Sans image, il garde son icône.
- Les miniatures de PDF montrent le haut de la première page, pas son centre souvent vide. Les vidéos ont une miniature prise à une seconde, la première image étant souvent noire.

## Historique des versions

- « Garder les versions précédentes » est une entrée cochée partout où un dossier a des actions : son menu du clic droit, le menu du nom du dossier ouvert dans le fil d'Ariane, et le clic droit dans la zone vide à l'intérieur. Les détails du dossier ont le même réglage sous forme d'interrupteur, dont la légende dit d'où vient le choix (« Activé pour tout le contenu de Clients ») ou ce que fait un remplacement quand il est désactivé.
- Un dossier ouvert qui garde les versions affiche une pastille « Versions gardées » à côté de son nom, qui ouvre ses détails.
- Le désactiver demande d'abord confirmation, en rouge, et dit ce que cela implique : les fichiers remplacés ensuite sont écrasés, les versions déjà gardées restent. L'activer ne demande rien.
- L'onglet « Versions » d'un fichier (panneau de détails, aussi « Historique des versions » dans le menu) : la version actuelle d'abord, les précédentes groupées par jour avec l'heure et la taille, une épingle sur les versions nommées. Un clic ouvre l'aperçu d'une version dans une fenêtre avec Télécharger et Restaurer ; le menu ajoute Nommer, Retirer le nom et Supprimer. La note de bas dit la place occupée et la règle de nettoyage en mots simples.
- Quand l'historique est désactivé, l'onglet le dit et propose de l'activer pour le dossier du fichier en un clic.
- « Importer une nouvelle version » (menu et onglet) garde le nom du fichier, quel que soit celui du fichier choisi.
- Le dialogue de conflit à l'import connaît l'historique : dans un dossier versionné, « Remplacer » est présélectionné et précise que le fichier actuel reste dans son historique ; ailleurs, « Garder les deux » reste le choix par défaut.
- Restaurer demande une confirmation et précise que rien n'est perdu ; supprimer une version aussi, car c'est définitif.

## Partage

- Un seul panneau : personnes (un sélecteur de rôle, Peut consulter / Peut modifier / Peut gérer, seulement à côté des membres de l'organisation : tous les autres sont lecteurs), accès hérités affichés avec leur origine, lien public (désactivé / toute personne disposant du lien), téléchargement autorisé, expiration, Copier le lien.
- Ajouter quelqu'un = une adresse email. Sans compte : invitation « compte » par défaut ; « lien personnel » en option, avec la mention honnête qu'il peut être transféré.
- Les liens public/personnels ne présentent jamais le visiteur comme identifié (« Lien public », « Paul (lien personnel) »).

## Organisations

- Une seule interface pour tout le monde, filtrée par ce que chaque personne peut faire sur chaque élément (`canEdit`, `canManage`) : une action impossible est absente, pas désactivée. Le serveur vérifie de toute façon.
- Les membres voient Accueil, Mon Drive, Récents, Favoris et Corbeille. Leur Mon Drive liste leur propre dossier et les dossiers partagés avec eux ; « Nouveau » n'apparaît que dans un dossier. Personnes, Partagés et le journal complet restent aux propriétaires.
- Le panneau de détails montre les onglets Accès et Activité à ceux qui gèrent l'élément, Versions à ceux qui peuvent le modifier.
- Personnes : un badge de rôle (Membre, Propriétaire) et « Passer en lecteur / membre / propriétaire » dans le menu de chacun ; créer un compte demande le rôle et indique les places utilisées. Les Paramètres montrent la licence (organisation, places, expiration) et comment configurer une clé.

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
