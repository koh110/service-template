const jstFormatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
})

export function formatJst(seconds: number) {
  if (!Number.isSafeInteger(seconds) || seconds < 0) {
    return '--'
  }
  const date = new Date(seconds * 1000)
  if (Number.isNaN(date.getTime())) {
    return '--'
  }
  return `${jstFormatter.format(date)} JST`
}
