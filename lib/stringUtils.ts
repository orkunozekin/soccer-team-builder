//capitalize every word of a given string
export function capitalizeFirstLetter(str?: string): string {
  if (!str) return ''
  const strSplitIntoWords = str.trim().split(' ')
  const capitalizedWords = strSplitIntoWords.map(
    word => `${word[0]?.toUpperCase()}${word?.slice(1, str.length)}`
  )
  return capitalizedWords.join(' ')
}
