import type { Catalog } from '..'
import type en from '../en/invite'

export default {
  title: 'Invitation',
  titleFrom: '{name} vous invite',
  notFound: 'Invitation introuvable',
  notFoundText: 'Ce lien n’est plus valide. Demandez une nouvelle invitation à la personne qui vous l’a envoyé.',
  accepted: 'Invitation déjà acceptée',
  acceptedText: 'Connectez-vous pour retrouver vos documents.',
  expired: 'Invitation expirée',
  expiredText: 'Demandez à {name} de vous renvoyer une invitation.',
  signIn: 'Se connecter',
  sharedItems: { one: '{name} vous a partagé un élément', other: '{name} vous a partagé {count} éléments' },
  more: 'et {count} autres…',
  accountExists: 'Un compte existe déjà pour {email}. Acceptez puis connectez-vous.',
  acceptAndSignIn: 'Accepter et se connecter',
  createAccess: 'Créez votre accès pour {email}. Il vous servira à retrouver ces documents.',
  name: 'Votre nom',
  password: 'Choisissez un mot de passe',
  passwordHint: 'Au moins 10 caractères.',
  submit: 'Accéder aux documents',
  failed: 'Impossible d’accepter l’invitation',
} satisfies Catalog<typeof en>
