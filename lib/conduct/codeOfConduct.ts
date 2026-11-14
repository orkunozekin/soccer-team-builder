import type { CodeOfConductSection } from '@/types/conduct'

/**
 * Stored with each agreement. Bump it (an ISO date) when the text changes.
 * Agreeing to any version counts for now: members agree once and are not
 * asked again after an edit.
 */
export const CODE_OF_CONDUCT_VERSION = '2026-11-14'

export const CODE_OF_CONDUCT_REQUIRED_CODE = 'CODE_OF_CONDUCT_REQUIRED'

export const CODE_OF_CONDUCT_REQUIRED_MESSAGE =
  'Agree to the code of conduct to RSVP.'

export const CODE_OF_CONDUCT_INTRO =
  'We play to have fun, stay fit and look after each other. By joining a game you agree to:'

export const CODE_OF_CONDUCT_SECTIONS: readonly CodeOfConductSection[] = [
  {
    title: 'Respect everyone',
    points: [
      'Treat teammates, opponents, organizers and referees with respect, on the pitch and in club chats.',
      'No harassment, bullying, threats or abuse, and no discrimination based on race, ethnicity, nationality, religion, gender, sexual orientation, disability or age.',
      'Keep trash talk friendly. If someone asks you to stop, stop.',
    ],
  },
  {
    title: 'Play safe',
    points: [
      'No reckless or dangerous tackles, and no slide tackles unless your club allows them.',
      'No fighting, pushing or retaliation. Walk away and tell an organizer.',
      'Stop play when someone is hurt, and wear shin guards and suitable footwear.',
      'Only play when you are fit to. Don’t play under the influence of alcohol or drugs.',
    ],
  },
  {
    title: 'Play fair',
    points: [
      'In self-refereed games, call your own fouls and balls out of play honestly.',
      'Accept calls you disagree with, settle disputes quickly and get the game going again.',
      'Play the team you’re on. Don’t stack teams or ask to swap without an organizer.',
    ],
  },
  {
    title: 'Show up when you say you will',
    points: [
      'RSVP only when you plan to come. Other players may be waiting for a spot.',
      'If your plans change, cancel your RSVP as early as you can.',
      'Arrive on time and check in when you get there.',
    ],
  },
  {
    title: 'Respect the venue and the club',
    points: [
      'Follow the facility’s rules, park where you’re allowed to and leave the field as you found it.',
      'Don’t share other members’ contact details, photos or videos without their permission.',
    ],
  },
  {
    title: 'If something goes wrong',
    points: [
      'Tell a club admin about injuries, unsafe play or behavior that breaks this code.',
      'Club admins may warn you, remove you from a match, or remove you from the club if you break this code.',
    ],
  },
]
