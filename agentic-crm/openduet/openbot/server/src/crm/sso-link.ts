import type { SSOOptions } from "@better-auth/sso";

type ResolveUser = NonNullable<SSOOptions["resolveUser"]>;

const onDomain = (email: string, domains: string) => {
  const emailDomain = email.split("@")[1]?.trim().toLowerCase() ?? "";
  return domains
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .some(
      (domain) =>
        domain &&
        (emailDomain === domain || emailDomain.endsWith(`.${domain}`)),
    );
};

/**
 * Signs somebody who already exists (added by SCIM, by an admin, or with a password) in through their
 * company's identity provider. Better Auth only links a provider whose domain is DNS-verified; an admin
 * registering the provider for that domain is the verification here, so only that domain is linked.
 */
export const linkExistingUser: ResolveUser = async (input, { database }) => {
  const email = input.providerUser.email.trim().toLowerCase();
  const provider = await database.findOne<{ domain: string }>({
    model: "ssoProvider",
    where: [{ field: "providerId", value: input.providerId }],
  });
  if (!provider || !onDomain(email, provider.domain)) {
    return { action: "continue" };
  }
  const user = await database.findOne<{ id: string }>({
    model: "user",
    where: [{ field: "email", value: email }],
  });
  return user
    ? { action: "link", userId: user.id, profile: "preserve" }
    : { action: "continue" };
};
