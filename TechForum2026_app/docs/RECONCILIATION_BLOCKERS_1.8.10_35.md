# Programme/speaker reconciliation blockers — 1.8.10 (35)

This file records unresolved identity/publication facts. It is not an instruction to mutate production.

## Ivan Bondarenko

Proven:

- programme speaker id `ss_9549f3332e335f3a`;
- registry id `9549f333-2e33-5f3a-89a9-ad06651c5e93`;
- session `ev_4ed0cf7acbbceb`;
- name, role, company and exact topic are present in both the canonical programme and registry;
- owner override says to retain Ivan in the programme.

Not proven for public publication:

- `public_card_uuid` is null;
- registry status is `published=false`;
- no verified real photo; the registry explicitly forbids a placeholder or AI-generated face;
- live `/tfapi/v1/sessions` currently returns this session with empty `speakerIds`;
- live `/tfapi/v1/speakers` contains 33 rows and does not contain Ivan, while the canonical programme/registry contains 34 programme identities.

Safe client decision: retain the session and its proven speaker link, expose an initials-only programme detail card, but do not inject Ivan into the general 33-card speaker list. Production must reconcile the server link and decide which exact 33/34 identities are public before a store build.

## Irina Piontkovskaya

Live API and the canonical registry agree on `Ирина Пионтковская`, but the registry has no session ids and records `published=false`. The client preserves the live row byte-for-byte. Removal, renaming or attaching a session requires owner/editorial evidence.

## Sergey Klosep patronymic

Live API currently returns `Клосеп Сергей Кирилловис`; the canonical programme/registry uses `Кириллович`. The client does not silently rewrite production identity data. Required reconciliation: owner-approved source-of-truth correction in the server/CMS, followed by a fresh 33-speaker snapshot and identity-link audit.
