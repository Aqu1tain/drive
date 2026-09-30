// Demo content created through the public API, so it exercises the real code paths.
// Usage: node scripts/seed.mjs [baseUrl]   (owner credentials via SEED_EMAIL / SEED_PASSWORD)
import sharp from 'sharp'

const BASE = process.argv[2] ?? process.env.SEED_BASE_URL ?? 'http://localhost:3000'
const OWNER = { email: process.env.SEED_EMAIL ?? 'owner@example.com', password: process.env.SEED_PASSWORD ?? 'correct-horse-battery', name: 'Camille Laurent' }

function client() {
  const cookies = new Map()
  async function request(method, path, { json, body, headers = {} } = {}) {
    const response = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        origin: BASE,
        ...(cookies.size ? { cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
        ...(json ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      body: json ? JSON.stringify(json) : body,
    })
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';')
      const index = pair.indexOf('=')
      cookies.set(pair.slice(0, index), pair.slice(index + 1))
    }
    const text = await response.text()
    const data = text && response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text
    if (!response.ok) throw new Error(`${method} ${path} → ${response.status} ${text.slice(0, 200)}`)
    return data
  }
  return { request }
}

function pdf(title, lines) {
  const text = [title, '', ...lines].map(line => line.replace(/[’]/g, "'")).map((line, i) => `BT /F1 ${i === 0 ? 20 : 12} Tf 72 ${760 - i * 22} Td (${line.replace(/[()\\]/g, '')}) Tj ET`).join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ]
  let out = '%PDF-1.4\n'
  const offsets = []
  objects.forEach((object, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new Uint8Array(Buffer.from(out, 'latin1'))
}

async function photo(hue, label) {
  const width = 1600
  const height = 1066
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue},55%,62%)"/><stop offset="1" stop-color="hsl(${(hue + 50) % 360},60%,32%)"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <circle cx="${width * 0.72}" cy="${height * 0.3}" r="120" fill="hsl(${(hue + 30) % 360},90%,85%)" opacity="0.9"/>
    <path d="M0 ${height * 0.78} Q ${width * 0.3} ${height * 0.55} ${width * 0.55} ${height * 0.75} T ${width} ${height * 0.7} V ${height} H 0 Z" fill="hsl(${(hue + 80) % 360},35%,22%)" opacity="0.85"/>
    <text x="60" y="${height - 60}" font-family="Helvetica" font-size="44" fill="white" opacity="0.85">${label}</text>
  </svg>`
  return new Uint8Array(await sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer())
}

const markdown = `# Programme du camp 2026

Du **12 au 19 juillet**, au bord du lac d’Annecy.

## Chaque jour
- 8h : petit-déjeuner
- 9h30 : activités nautiques
- 14h : randonnée ou atelier
- 20h30 : veillée

## À prévoir
1. Sac de couchage
2. Lampe frontale
3. Gourde

> Les parents peuvent consulter le programme mis à jour sur ce même lien.

Contact : [camp@example.com](mailto:camp@example.com)
`

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Informations pratiques</title>
<style>body{font-family:system-ui;margin:40px;max-width:640px;color:#1b1340}h1{color:#6d4aff}li{margin:6px 0}</style></head>
<body><h1>Informations pratiques</h1><p>Rendez-vous le <strong>12 juillet à 9h</strong>, parking du gymnase.</p>
<ul><li>Transport en car</li><li>Retour prévu le 19 juillet vers 17h</li></ul>
<p id="now"></p><script>document.getElementById('now').textContent = 'Script exécuté à ' + new Date().toLocaleTimeString()</script></body></html>`

const csv = `Date,Client,Montant HT,TVA,Statut
2026-01-14,Dupont,1200,240,Payée
2026-02-03,ACME,4800,960,Payée
2026-03-21,Martin & Fils,650,130,En attente
2026-04-02,Dupont,980,196,Payée
`

async function main() {
  const owner = client()
  const setup = await owner.request('GET', '/api/setup')
  if (setup.needed) await owner.request('POST', '/api/setup', { json: OWNER })
  await owner.request('POST', '/api/auth/sign-in/email', { json: { email: OWNER.email, password: OWNER.password } })

  const ids = new Map()
  async function folder(path) {
    if (ids.has(path)) return ids.get(path)
    const segments = path.split('/')
    const { id } = await owner.request('POST', '/api/folders/ensure', { json: { parentId: null, path: segments } })
    ids.set(path, id)
    return id
  }
  async function upload(path, name, bytes, type) {
    const parentId = path ? await folder(path) : null
    const query = new URLSearchParams({ name, conflict: 'replace', ...(parentId ? { parentId } : {}) })
    return owner.request('PUT', `/api/uploads?${query}`, { body: bytes, headers: { 'content-type': type } })
  }

  const devis = await upload('Clients/Dupont', 'Devis rénovation cuisine.pdf', pdf('Devis n° 2026-014', ['Client : M. et Mme Dupont', 'Rénovation complète de la cuisine', 'Montant HT : 12 400 EUR', 'Validité : 30 jours']), 'application/pdf')
  await upload('Clients/Dupont', 'Contrat signé.pdf', pdf('Contrat de prestation', ['Entre les soussignés…', 'Article 1 : Objet', 'Article 2 : Durée', 'Fait à Lyon, le 3 février 2026']), 'application/pdf')
  await upload('Clients/Dupont', 'Plan cuisine.jpg', await photo(28, 'Plan cuisine, version 3'), 'image/jpeg')
  await upload('Clients/ACME/Design', 'Maquette accueil.jpg', await photo(250, 'ACME, accueil'), 'image/jpeg')
  await upload('Clients/ACME/Design', 'Maquette tableau de bord.jpg', await photo(200, 'ACME, tableau de bord'), 'image/jpeg')
  await upload('Clients/ACME', 'Cahier des charges.md', new TextEncoder().encode('# Cahier des charges ACME\n\nRefonte du portail client.\n\n- Authentification unique\n- Tableau de bord\n- Export PDF\n'), 'text/markdown')
  const programme = await upload('Camp 2026', 'Programme.md', new TextEncoder().encode(markdown), 'text/markdown')
  await upload('Camp 2026', 'Informations pratiques.html', new TextEncoder().encode(html), 'text/html')
  await upload('Camp 2026', 'Carte du site.jpg', await photo(140, 'Carte du lac d’Annecy'), 'image/jpeg')
  await upload('Camp 2026/Administratif', 'Fiche sanitaire.pdf', pdf('Fiche sanitaire de liaison', ['Nom de l’enfant :', 'Allergies :', 'Traitement en cours :']), 'application/pdf')
  await upload('Camp 2026/Administratif', 'Autorisation parentale.pdf', pdf('Autorisation parentale', ['Je soussigné(e)…', 'autorise mon enfant à participer au camp.']), 'application/pdf')
  for (const [index, hue] of [12, 45, 95, 170, 205, 300].entries()) {
    await upload('Photos/Vacances été 2025', `IMG_${4210 + index}.jpg`, await photo(hue, `Été 2025, photo ${index + 1}`), 'image/jpeg')
  }
  await upload('Factures', 'Suivi des factures 2026.csv', new TextEncoder().encode(csv), 'text/csv')
  await upload('Factures', 'Facture 2026-003.pdf', pdf('Facture 2026-003', ['ACME SAS', 'Prestation de conception', 'Total TTC : 5 760 EUR']), 'application/pdf')
  await upload('Factures', 'Facture 2026-004.pdf', pdf('Facture 2026-004', ['Dupont', 'Acompte travaux', 'Total TTC : 1 176 EUR']), 'application/pdf')
  await upload(null, 'Notes de réunion.txt', new TextEncoder().encode('Réunion du 22 septembre\n\n- Point budget\n- Planning des livraisons\n- Prochaine réunion le 6 octobre\n'), 'text/plain')
  await upload(null, 'Rapport annuel 2026.pdf', pdf('Rapport annuel 2026', ['Synthèse de l’activité', 'Chiffre d’affaires : +18 %', 'Nouveaux clients : 12']), 'application/pdf')

  const people = [
    { name: 'Paul Martin', email: 'paul.martin@example.com', password: 'paul-password-1' },
    { name: 'Marie Dubois', email: 'marie.dubois@example.com', password: 'marie-password-1' },
  ]
  for (const person of people) {
    await owner.request('POST', '/api/people', { json: person }).catch(() => {})
  }
  const dupont = await folder('Clients/Dupont')
  await owner.request('POST', `/api/resources/${dupont}/access`, { json: { email: 'paul.martin@example.com', notify: false } })
  await owner.request('POST', `/api/resources/${devis.id}/access`, { json: { email: 'marie.dubois@example.com', notify: false, allowDownload: false } })
  await owner.request('POST', `/api/resources/${await folder('Clients/ACME')}/access`, { json: { email: 'jeanne@acme.example', name: 'Jeanne (ACME)', notify: false } })
  const camp = await folder('Camp 2026')
  const link = await owner.request('PUT', `/api/resources/${camp}/link`, { json: { enabled: true, allowDownload: true } })
  await owner.request('PUT', `/api/resources/${devis.id}/star`, { json: { starred: true } })
  await owner.request('PUT', `/api/resources/${await folder('Photos/Vacances été 2025')}/star`, { json: { starred: true } })

  const paul = client()
  await paul.request('POST', '/api/auth/sign-in/email', { json: { email: 'paul.martin@example.com', password: 'paul-password-1' } })
  await paul.request('POST', `/api/resources/${devis.id}/open`)
  await paul.request('GET', `/api/resources/${devis.id}/download`)

  const token = new URL(link.link.url).pathname.split('/').pop()
  for (let i = 0; i < 3; i++) {
    const visitor = client()
    await visitor.request('GET', `/api/s/${token}`)
    await visitor.request('POST', `/api/s/${token}/resources/${programme.id}/open`)
  }
  console.info(`Demo content ready. Public link: ${link.link.url}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
