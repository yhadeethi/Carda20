Carda Home Scoreboard + Photos-style Dock (DELTA PATCH)

Files included (copy into your repo, preserving paths):
- client/src/pages/home-page.tsx
- client/src/components/home/HomeScoreboard.tsx
- client/src/hooks/useScoreboard.ts
- client/src/lib/contacts/types.ts
- client/src/components/contact/ContactDetailView.tsx
- client/src/components/relationship/RelationshipDetailView.tsx

Notes:
- Adds Home as default landing + new bottom dock (Home circle + Scan/Relationships/Events pill).
- Adds timeline event type `followup_sent` and logs it on follow-up actions.
- Adds Home scoreboard (Due + New + optional Insights) computed from local v2 storage for now.

Next storage step:
- Update useScoreboard to pull from useContacts() (cloud/local router) so counts match cloud data.


Additional fix:
- client/src/hooks/useAuth.ts (edited): adds proper typing for the user object returned from /api/auth/user.
