import type { Catalog } from '..'
import type en from '../en/documents'

export default {
  contents: 'Sommaire',
  emptyBook: 'Ce livre n’a aucun chapitre lisible.',
  emptySheet: 'Feuille vide',
  emptyWorkbook: 'Classeur vide',
  truncatedRows: 'Seules les {count} premières lignes sont affichées.',
  slidesNote: 'Aperçu du texte des diapositives. Téléchargez le fichier pour la mise en page complète.',
  emptySlide: 'Diapositive sans texte',
} satisfies Catalog<typeof en>
