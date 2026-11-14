export interface CodeOfConductSection {
  title: string
  points: readonly string[]
}

/** A member's agreement to the code of conduct (one per user, all clubs). */
export interface CodeOfConductAgreementDTO {
  /** The `CODE_OF_CONDUCT_VERSION` the member agreed to. */
  version: string
  agreedAt: string | null
}

export interface CodeOfConductStatusDTO {
  /** True when the club requires the code and the caller hasn't agreed yet. */
  required: boolean
  agreement: CodeOfConductAgreementDTO | null
}
