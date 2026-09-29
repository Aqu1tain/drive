[English](privacy.md) · **Français**

# Données collectées

Drive enregistre le strict nécessaire pour répondre à une question : qui a consulté ce document, quand, et combien de fois.

## Pour chaque consultation ou téléchargement

| Donnée | Pourquoi | Conservée |
|---|---|---|
| Ressource, type d'action, date | Répondre à « qui a vu quoi, quand » | Durée de rétention (365 jours par défaut) |
| Compte lecteur ou invitation | Attribuer la consultation à une personne identifiée | Idem |
| Identifiant de visiteur aléatoire (cookie `drive_vid`) | Compter les visiteurs distincts d'un lien public, sans les identifier | Cookie d'un an côté navigateur ; en base, idem rétention |
| Réseau d'origine haché | Distinguer des visiteurs anonymes : l'adresse est tronquée (/24 en IPv4, /48 en IPv6) puis hachée avec un secret du serveur | Idem ; désactivable avec `ACTIVITY_IP_MODE=none` |
| Navigateur (user-agent, 256 caractères max) | Diagnostic | Idem |

Plusieurs ouvertures d'un même document par la même personne en moins de 10 minutes comptent pour une seule consultation. Le chargement des ressources d'une page (images, styles) n'est jamais compté.

## Ce que Drive ne fait pas

- Aucun traceur tiers, aucune analyse d'audience externe, aucune police chargée depuis un service tiers.
- Les visiteurs d'un lien public ne sont jamais présentés comme identifiés dans l'interface.
- Les miniatures d'images sont générées sans les métadonnées (EXIF, position GPS).

## Journaux techniques

La sortie standard du conteneur contient, pour chaque requête : identifiant de requête, méthode, chemin (jetons masqués), statut, durée, identifiant de compte et de ressource. Ils servent au diagnostic et ne sont pas exposés aux lecteurs. Leur conservation dépend de la configuration Docker du serveur.

## Réglages

- `ACTIVITY_RETENTION_DAYS` : les événements plus anciens sont supprimés chaque nuit.
- `ACTIVITY_IP_MODE=none` : aucune donnée réseau n'est enregistrée.
