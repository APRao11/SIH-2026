// Deterministic first-aid guidance shown to a bystander immediately after an
// alert is reported. Kept static and concise for the MVP: no AI/LLM calls, no
// diagnosis, and no medication doses. Professional help (108) is always the
// first step and the guidance never replaces a doctor or an ambulance.
export const FIRST_AID_SAFETY_MESSAGE =
  'First-aid steps are temporary help while you wait for professional medical services. Always contact emergency medical services (108) — this guidance does not replace a doctor or an ambulance.'

const accidentSteps = [
  'Call 108 for the ambulance right away.',
  'Check that you, the person, and the area are safe before you go closer.',
  'Keep the person still and check whether they are breathing normally.',
  'If trained and it is safe, press firmly on any heavy bleeding with a clean cloth.',
]
const accidentDonts = [
  'Do not move the person unless the area is unsafe.',
  'Do not give them anything to eat or drink.',
]

const cardiacSteps = [
  'Call 108 now and follow the dispatcher’s instructions.',
  'Check whether the person is awake and breathing normally.',
  'If they are not breathing normally, start hands-only CPR if you know how.',
  'Ask someone to bring an AED if one is nearby, and use it if available.',
]
const cardiacDonts = [
  'Do not wait — start CPR immediately if the person is not breathing normally.',
  'Do not give the person water or any medicine.',
]

const burnSteps = [
  'Call 108 for medical help.',
  'Move the person away from the heat source only if it is safe.',
  'Cool the burn with clean running water for 20 minutes.',
  'Cover the burn loosely with a clean, dry cloth.',
]
const burnDonts = [
  'Do not apply ice, creams, oils, or butter — these make the burn worse.',
  'Do not burst any blisters.',
]

const unconsciousSteps = [
  'Call 108 immediately.',
  'Check whether the person is responding and breathing normally.',
  'If they are not breathing normally, start CPR if you know how and use an AED if available.',
  'If they are breathing, turn them gently onto their side and keep watching their breathing.',
]
const unconsciousDonts = [
  'Do not give food, drink, or medicine to an unconscious person.',
  'Do not leave the person alone.',
]

const otherSteps = [
  'Call 108 for professional medical help.',
  'Check that the area is safe before you go near the person.',
  'Keep the person comfortable and keep watching their breathing.',
  'Stay with them until help arrives.',
]
const otherDonts = [
  'Do not move the person unless they are in immediate danger.',
  'Do not give any medicine or doses unless a professional tells you to.',
]

const firstAidGuidance = {
  Accident: { steps: accidentSteps, donts: accidentDonts },
  'Cardiac emergency': { steps: cardiacSteps, donts: cardiacDonts },
  Burns: { steps: burnSteps, donts: burnDonts },
  'Unconscious Person': { steps: unconsciousSteps, donts: unconsciousDonts },
  Other: { steps: otherSteps, donts: otherDonts },
}

export function getFirstAidGuidance(emergencyType) {
  if (emergencyType === 'Burn') return firstAidGuidance.Burns
  return firstAidGuidance[emergencyType] || firstAidGuidance.Other
}

// Only these categories use deterministic guidance. "Other" is intentionally
// handled by the server-side AI endpoint after the bystander adds context.
export function hasFixedFirstAidGuidance(emergencyType) {
  return ['Accident', 'Cardiac emergency', 'Burns', 'Burn', 'Unconscious Person'].includes(emergencyType)
}

export default firstAidGuidance
