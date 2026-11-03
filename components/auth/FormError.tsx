export function FormError({ message }: { message: string | null | undefined }) {
  if (!message) return null
  return <p className="-mt-2 text-sm font-medium text-danger">{message}</p>
}
