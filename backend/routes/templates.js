'use strict'

const express = require('express')
const { normaliseOperationalText } = require('../db/utils')

const SHORTCODE_HELP = {
  general: ['{{company.name}}','{{company.phone}}','{{company.email}}','{{company.address}}','{{company.vat_number}}','{{company.logo_url}}'],
  customer: ['{{customer.name}}','{{customer.first_name}}','{{customer.surname}}','{{customer.phone}}','{{customer.email}}','{{customer.address}}','{{customer.postcode}}'],
  vehicle: ['{{vehicle.registration}}','{{vehicle.make}}','{{vehicle.model}}','{{vehicle.colour}}','{{vehicle.year}}','{{vehicle.fuel_type}}','{{vehicle.mileage}}'],
  job: ['{{job.id}}','{{job.title}}','{{job.status}}','{{job.booked_start}}','{{job.booked_end}}','{{job.customer_statement}}','{{job.internal_notes}}'],
  quote: ['{{quote.quote_number}}','{{quote.status}}','{{quote.date}}','{{quote.items_html}}','{{quote.subtotal_ex_vat}}','{{quote.vat_total}}','{{quote.total_inc_vat}}','{{quote.notes}}'],
  invoice: ['{{invoice.invoice_number}}','{{invoice.status}}','{{invoice.date}}','{{invoice.items_html}}','{{invoice.subtotal_ex_vat}}','{{invoice.vat_total}}','{{invoice.total_inc_vat}}','{{invoice.notes}}'],
  job_sheet: ['{{job_sheet.tasks_html}}','{{job_sheet.parts_html}}','{{job_sheet.checklist_html}}'],
}

function render(template, data) {
  let out = String(template || '')
  for (const [k, v] of Object.entries(data || {})) {
    out = out.split(`{{${k}}}`).join(v == null ? '' : String(v))
  }
  return out
}

function fmtMoney(v) { return Number(v || 0).toFixed(2) }

async function buildContext(db, { quoteId, invoiceId, jobId }) {
  const ctx = {}
  const company = await db.get(`SELECT * FROM company_settings ORDER BY id ASC LIMIT 1`)
  ctx['company.name'] = company?.company_name || 'AUTOSS GARAGE'
  ctx['company.phone'] = company?.phone || ''
  ctx['company.email'] = company?.email || ''
  ctx['company.address'] = company?.address || ''
  ctx['company.vat_number'] = company?.vat_number || ''
  ctx['company.logo_url'] = '/brand/logo.png'

  if (quoteId) {
    const q = await db.get(`SELECT q.*, c.first_name,c.surname,c.phone,c.email,c.address,c.postcode, v.registration,v.make,v.model,v.colour,v.year,v.fuel_type, j.title AS job_title,j.status AS job_status,j.booked_start,j.booked_end,j.notes_customer_words,j.notes_internal FROM quotes q JOIN customers c ON c.id=q.customer_id JOIN vehicles v ON v.id=q.vehicle_id LEFT JOIN jobs j ON j.id=q.job_id WHERE q.id=?`, [quoteId])
    if (q) {
      const items = await db.all(`SELECT * FROM quote_items WHERE quote_id=? AND selected_for_quote=1 ORDER BY sort_order ASC,id ASC`, [quoteId])
      const itemsHtml = (items || []).map((i) => `<tr><td>${i.description || ''}</td><td>${i.quantity}</td><td>£${fmtMoney(i.unit_sell)}</td><td>£${fmtMoney(Number(i.total_sell||0) * (1 + Number(i.vat_rate||0.2)))}</td></tr>`).join('')
      Object.assign(ctx, {
        'customer.name': `${q.first_name || ''} ${q.surname || ''}`.trim(), 'customer.first_name': q.first_name || '', 'customer.surname': q.surname || '', 'customer.phone': q.phone || '', 'customer.email': q.email || '', 'customer.address': q.address || '', 'customer.postcode': q.postcode || '',
        'vehicle.registration': q.registration || '', 'vehicle.make': q.make || '', 'vehicle.model': q.model || '', 'vehicle.colour': q.colour || '', 'vehicle.year': q.year || '', 'vehicle.fuel_type': q.fuel_type || '', 'vehicle.mileage': '',
        'job.id': q.job_id || '', 'job.title': q.job_title || '', 'job.status': q.job_status || '', 'job.booked_start': q.booked_start || '', 'job.booked_end': q.booked_end || '', 'job.customer_statement': q.notes_customer_words || '', 'job.internal_notes': q.notes_internal || '',
        'quote.quote_number': q.quote_number || '', 'quote.status': q.status || '', 'quote.date': String(q.updated_at || q.created_at || ''), 'quote.items_html': itemsHtml,
        'quote.subtotal_ex_vat': fmtMoney(q.subtotal_sell), 'quote.vat_total': fmtMoney(q.vat_amount), 'quote.total_inc_vat': fmtMoney(q.total_sell), 'quote.notes': q.customer_notes || '',
      })
      ctx['job_sheet.tasks_html'] = `<ul>${(items || []).map((i) => `<li>[ ] ${i.description || ''}</li>`).join('')}</ul>`
      const parts = await db.all(`SELECT * FROM parts_orders WHERE job_id=? ORDER BY id ASC`, [q.job_id || 0])
      ctx['job_sheet.parts_html'] = `<ul>${(parts || []).map((p) => `<li>[ ] ${p.part_name || p.description || ''} - ${p.status || ''}</li>`).join('')}</ul>`
      ctx['job_sheet.checklist_html'] = '<ul><li>[ ] TEST DRIVEN</li><li>[ ] READY TO CALL CUSTOMER</li></ul>'
    }
  }

  if (invoiceId) {
    const inv = await db.get(`SELECT i.*, c.first_name,c.surname, v.registration,v.make,v.model FROM invoices i LEFT JOIN customers c ON c.id=i.customer_id LEFT JOIN vehicles v ON v.id=i.vehicle_id WHERE i.id=?`, [invoiceId])
    if (inv) {
      const items = await db.all(`SELECT * FROM invoice_items WHERE invoice_id=? ORDER BY id ASC`, [invoiceId])
      const itemsHtml = (items || []).map((i) => `<tr><td>${i.description || ''}</td><td>${i.quantity}</td><td>£${fmtMoney(i.unit_price_ex_vat)}</td><td>£${fmtMoney(i.total_inc_vat)}</td></tr>`).join('')
      Object.assign(ctx, {
        'invoice.invoice_number': inv.invoice_number || '', 'invoice.status': inv.status || '', 'invoice.date': String(inv.updated_at || inv.created_at || ''), 'invoice.items_html': itemsHtml,
        'invoice.subtotal_ex_vat': fmtMoney(inv.subtotal_ex_vat), 'invoice.vat_total': fmtMoney(inv.vat_total), 'invoice.total_inc_vat': fmtMoney(inv.total_inc_vat), 'invoice.notes': inv.notes || '',
        'customer.name': `${inv.first_name || ''} ${inv.surname || ''}`.trim(), 'vehicle.registration': inv.registration || '', 'vehicle.make': inv.make || '', 'vehicle.model': inv.model || '',
      })
    }
  }

  if (jobId && !quoteId) {
    const job = await db.get(`SELECT j.*, c.first_name,c.surname, v.registration,v.make,v.model,v.colour,v.year,v.fuel_type FROM jobs j JOIN customers c ON c.id=j.customer_id JOIN vehicles v ON v.id=j.vehicle_id WHERE j.id=?`, [jobId])
    if (job) {
      Object.assign(ctx, {
        'job.id': job.id || '', 'job.title': job.title || '', 'job.status': job.status || '', 'job.booked_start': job.booked_start || '', 'job.booked_end': job.booked_end || '', 'job.customer_statement': job.notes_customer_words || '', 'job.internal_notes': job.notes_internal || '',
        'customer.name': `${job.first_name || ''} ${job.surname || ''}`.trim(), 'vehicle.registration': job.registration || '', 'vehicle.make': job.make || '', 'vehicle.model': job.model || '', 'vehicle.colour': job.colour || '', 'vehicle.year': job.year || '', 'vehicle.fuel_type': job.fuel_type || '',
      })
    }
  }

  return ctx
}

function createTemplatesRouter({ db }) {
  const router = express.Router()

  router.get('/templates', async (_req, res) => {
    try {
      const rows = await db.all(`SELECT id, template_key, template_type, name, subject, active, updated_at FROM document_templates ORDER BY template_type, name`)
      res.json({ ok: true, templates: rows || [], shortcode_help: SHORTCODE_HELP })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load templates.' })
    }
  })

  router.get('/templates/:key', async (req, res) => {
    const row = await db.get(`SELECT * FROM document_templates WHERE template_key=?`, [String(req.params.key || '')])
    if (!row) return res.status(404).json({ ok: false, error: 'Template not found.' })
    res.json({ ok: true, template: row, shortcode_help: SHORTCODE_HELP })
  })

  router.patch('/templates/:key', async (req, res) => {
    const key = String(req.params.key || '')
    const body = req.body || {}
    try {
      const row = await db.get(`SELECT * FROM document_templates WHERE template_key=?`, [key])
      if (!row) return res.status(404).json({ ok: false, error: 'Template not found.' })
      const next = {
        name: body.name != null ? normaliseOperationalText(body.name) : row.name,
        subject: body.subject != null ? String(body.subject) : row.subject,
        body_html: body.body_html != null ? String(body.body_html) : row.body_html,
        body_text: body.body_text != null ? String(body.body_text) : row.body_text,
        active: body.active != null ? (body.active ? 1 : 0) : row.active,
      }
      await db.run(`UPDATE document_templates SET name=?,subject=?,body_html=?,body_text=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE template_key=?`, [next.name, next.subject, next.body_html, next.body_text, next.active, key])
      const updated = await db.get(`SELECT * FROM document_templates WHERE template_key=?`, [key])
      res.json({ ok: true, template: updated })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to update template.' })
    }
  })

  router.post('/templates/:key/render', async (req, res) => {
    const key = String(req.params.key || '')
    const body = req.body || {}
    try {
      const tpl = await db.get(`SELECT * FROM document_templates WHERE template_key=? AND active=1`, [key])
      if (!tpl) return res.status(404).json({ ok: false, error: 'Template not found.' })
      const context = await buildContext(db, {
        quoteId: body.quote_id ? Number(body.quote_id) : null,
        invoiceId: body.invoice_id ? Number(body.invoice_id) : null,
        jobId: body.job_id ? Number(body.job_id) : null,
      })
      const rendered_html = tpl.body_html ? render(tpl.body_html, context) : null
      const rendered_text = tpl.body_text ? render(tpl.body_text, context) : null
      const rendered_subject = tpl.subject ? render(tpl.subject, context) : null
      res.json({ ok: true, template_key: key, rendered_html, rendered_text, rendered_subject, context })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to render template.' })
    }
  })

  return router
}

module.exports = { createTemplatesRouter }
