/**
 * Profile-field validation shared by onboarding (`POST /user/demo`) and profile
 * updates (`PUT /user/:id`). The length caps are not cosmetic: every field is
 * persisted inside the session cookie, so an unbounded string could push the
 * cookie past the browser limit and reset the whole session.
 */

export const PROFILE_NAME_MAX = 60;
export const PROFILE_EMAIL_MAX = 120;
export const PROFILE_ADDRESS_MAX = 100;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ProfileBody {
  name?: unknown;
  email?: unknown;
  address?: unknown;
}

export interface ProfileValues {
  name?: string;
  email?: string;
  address?: string;
}

/**
 * `requireIdentity` = true makes name and email mandatory (first-run
 * onboarding). Otherwise only the fields actually present are validated, so a
 * partial `PUT` can move the threshold without resending the profile.
 */
export function validateProfile(
  body: ProfileBody,
  { requireIdentity = false }: { requireIdentity?: boolean } = {},
): { values: ProfileValues; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const values: ProfileValues = {};

  if (body.name !== undefined || requireIdentity) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) errors.name = "Name cannot be empty";
    else if (name.length > PROFILE_NAME_MAX)
      errors.name = `Name must be ${PROFILE_NAME_MAX} characters or fewer`;
    else values.name = name;
  }

  if (body.email !== undefined || requireIdentity) {
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!email) errors.email = "Email is required";
    else if (email.length > PROFILE_EMAIL_MAX)
      errors.email = `Email must be ${PROFILE_EMAIL_MAX} characters or fewer`;
    else if (!EMAIL_RE.test(email)) errors.email = "Invalid email format";
    else values.email = email;
  }

  if (body.address !== undefined) {
    const address = typeof body.address === "string" ? body.address.trim() : "";
    if (address.length > PROFILE_ADDRESS_MAX)
      errors.address = `Address must be ${PROFILE_ADDRESS_MAX} characters or fewer`;
    else values.address = address;
  }

  return { values, errors };
}
