import { createTransport, type Transporter } from 'nodemailer'

let transporter: Transporter | undefined

export const canSendEmail = () => !!useRuntimeConfig().smtp.url

export async function sendEmail(to: string, subject: string, text: string, html: string) {
  const { smtp } = useRuntimeConfig()
  if (!smtp.url) return false
  transporter ??= createTransport(smtp.url)
  await transporter.sendMail({ from: smtp.from, to, subject, text, html })
  return true
}

const escape = (value: string) => value.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)

/** A deliberately plain layout: readable in every client, nothing to track. */
export function emailLayout(title: string, lines: string[], action?: { label: string, url: string }) {
  const { appName } = useRuntimeConfig().public
  const button = action
    ? `<p style="margin:28px 0"><a href="${escape(action.url)}" style="background:#6d4aff;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${escape(action.label)}</a></p>`
    : ''
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f5f4f2;font-family:Inter,system-ui,sans-serif;color:#0c0c14">
<div style="max-width:520px;margin:0 auto;padding:40px 24px">
<div style="background:#fff;border-radius:12px;padding:32px">
<h1 style="font-size:20px;margin:0 0 16px">${escape(title)}</h1>
${lines.map(line => `<p style="font-size:15px;line-height:22px;margin:0 0 12px;color:#3d3b3a">${escape(line)}</p>`).join('')}
${button}
</div>
<p style="font-size:12px;color:#75726f;margin-top:16px">${escape(appName)}</p>
</div></body></html>`
  const text = [title, '', ...lines, ...(action ? ['', `${action.label} : ${action.url}`] : [])].join('\n')
  return { html, text }
}
