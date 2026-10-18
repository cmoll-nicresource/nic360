# Users, subscribers and attendees

Use these terms throughout site copy, staff tools, code and documentation:

- **User:** anyone with a site account and login credentials. A user can have a subscription, conference registrations, both, or neither. Staff CMS accounts are separate and are called **staff**.
- **Subscriber:** a user with a subscription through an **access provider**. Effective content access still depends on the provider's plan, status and expiry, and the user's verification and account status. Merely linking a provider does not grant subscription access.
- **Attendee:** a user registered for a particular conference. Always name or otherwise establish that conference context. Registration does not imply a subscription, and a subscriber can also be an attendee.
- **Member:** a user whose access provider is a dues-paying member of the **Nicotine Resource Consortium**. This organizational distinction is not used by the site; do not use “member” as an account type, access label, role or synonym for subscriber.

Publication email preferences are separate from a content subscription. Receiving a newsletter requires the applicable subscription access and email eligibility/consent checks.

The `users` collection stores site accounts; `access-providers` stores provider subscription settings; `event-registrations` links users to individual events. `getSubscriptionPlan` determines subscription access, while `hasActiveRegistration` checks a particular event. Neither depends on NRC membership.

Historical migration filenames and external API identifiers (such as Mailchimp's `members` endpoint) retain their original names for compatibility. They do not define a site membership concept. The existing `membership@nicotine360.org` contact address and legacy homepage `#membership` anchor are also retained.
