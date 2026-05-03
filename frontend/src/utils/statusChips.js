// Central place for mapping backend statuses to UI chip styles.
// Keep this beginner-friendly: one function per domain.

export function partsOrderTone(status) {
  switch (String(status || '')) {
    case 'pending':
      return 'chipGrey'
    case 'ordered':
      return 'chipOrange'
    case 'received':
      return 'chipGreen'
    case 'return_required':
      return 'chipRedOrange'
    case 'returned':
      return 'chipRedOrange'
    case 'credit_pending':
      return 'chipPurple'
    case 'credited':
      return 'chipGreen'
    case 'cancelled':
      return 'chipGrey'
    default:
      return 'chipGrey'
  }
}

export function jobPartsSummaryTone(partsStatus) {
  switch (String(partsStatus || '').toLowerCase()) {
    case 'no parts':
      return 'chipGrey'
    case 'to order':
      return 'chipGrey'
    case 'waiting':
      return 'chipOrange'
    case 'received':
      return 'chipGreen'
    case 'issue/return':
      return 'chipRedOrange'
    default:
      return 'chipGrey'
  }
}
