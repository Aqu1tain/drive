[English](organizations.md) · **Français**

# Drive pour les Organisations

Seul, Drive a un unique propriétaire. Drive pour les Organisations permet à plusieurs personnes de gérer des fichiers ensemble, tandis que toutes les personnes avec qui vous partagez restent des lecteurs qui ne peuvent jamais rien modifier.

## Qui fait quoi

| Rôle | Prend une place | Ce qu'il peut faire |
|---|---|---|
| Propriétaire | Oui | Tout : chaque fichier, les personnes, les places et les paramètres. Il peut y en avoir plusieurs. |
| Membre | Oui | Travaille dans son propre dossier et dans les dossiers partagés avec lui, selon son rôle sur chacun. |
| Lecteur | Non | Consulte ce qui est partagé avec lui. Ne modifie jamais rien. |

Un membre commence avec un dossier à son nom, à la racine du Drive. Il le gère, et les propriétaires le voient comme tout le reste. Son « Mon Drive » affiche ce dossier et tous les dossiers partagés avec lui.

Quand vous partagez un dossier avec un membre, vous choisissez ce qu'il peut faire :

| Rôle sur un dossier | Consulter et télécharger | Importer, renommer, déplacer, étiqueter, mettre à la corbeille, versions | Partager, lien public, historique des versions, suppression définitive, activité |
|---|---|---|---|
| Peut consulter | Oui | Non | Non |
| Peut modifier | Oui | Oui | Non |
| Peut gérer | Oui | Oui | Oui |

Les rôles s'appliquent à tout le contenu du dossier, comme n'importe quel partage. Les lecteurs, les invitations et les liens publics ne font jamais que consulter, quoi qu'il arrive.

## Mettre en place une licence

1. Écrivez à [contact@corentinrenard.com](mailto:contact@corentinrenard.com) en précisant votre organisation et le nombre de places nécessaires.
2. Vous recevez une clé de licence. Sur le serveur, lancez :

   ```bash
   ~/drive/install.sh license CLÉ
   ```

3. Ouvrez les **Paramètres** : la section Drive pour les Organisations indique à qui appartient la licence, les places utilisées et la date d'expiration.

La clé est signée par le concédant et vérifiée sur votre serveur, sans aucun appel réseau. Rien de votre Drive n'en sort jamais.

## Ajouter des personnes

Dans **Personnes**, **Créer un compte** et choisissez le rôle : lecteur, membre ou propriétaire. Le menu à côté de chaque personne change son rôle, désactive ou supprime son compte. Personne ne peut changer son propre rôle.

Les propriétaires et les membres actifs prennent une place ; les lecteurs sont gratuits. Désactiver quelqu'un ou le passer en lecteur libère sa place.

## Quand la licence expire

Rien ne casse et personne ne perd ses accès. Pendant les 14 jours qui suivent l'expiration, tout fonctionne comme avant. Ensuite, vous ne pouvez plus ajouter de membres ni de propriétaires, ni donner plus que la consultation, jusqu'au renouvellement. Chacun garde ce qu'il avait.

## Quand quelqu'un part

Supprimer son compte retire ses accès immédiatement, dès la requête suivante. Ce qu'il a créé reste dans le Drive, y compris son propre dossier, que les propriétaires peuvent déplacer ou partager avec quelqu'un d'autre.
