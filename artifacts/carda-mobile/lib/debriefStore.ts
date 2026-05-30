let _transcript = "";
let _contactId: number | null = null;

export const debriefStore = {
  setTranscript(t: string) {
    _transcript = t;
  },
  getTranscript(): string {
    return _transcript;
  },
  setContactId(id: number | null) {
    _contactId = id;
  },
  getContactId(): number | null {
    return _contactId;
  },
  clear() {
    _transcript = "";
    _contactId = null;
  },
};
