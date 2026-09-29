import type { Catalog } from '..'
import type en from '../en/emails'

export default {
  code: {
    subject: '{code} est votre code de connexion',
    title: 'Votre code de connexion : {code}',
    intro: 'Saisissez ce code pour vous connecter à {app}.',
    expiry: 'Il expire dans 10 minutes. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.',
  },
  share: {
    subject: '{sender} a partagé {name} avec vous',
    title: '{sender} a partagé un élément avec vous',
    file: '{sender} a partagé « {name} » avec vous.',
    folder: '{sender} a partagé le dossier « {name} » avec vous.',
    createAccount: 'Créez votre accès en quelques secondes pour le consulter.',
    personalLink: 'Ce lien vous est personnel : évitez de le transférer.',
    open: 'Ouvrir',
  },
} satisfies Catalog<typeof en>
