export class NavienUser {
  constructor(
    readonly userId: string,
    readonly accountSeq: number,
    readonly userSeq: number,
    readonly homeSeq: number,
  ) {
  }

  static fromJSON(json: unknown): NavienUser {
    if (typeof json !== 'object' || json === null) {
      throw new Error('Invalid JSON for NavienUser');
    }

    // if familySeq is in json, it means the json is outdated (for Navien API v1.0)
    if ('familySeq' in json) {
      throw new Error('JSON Schema is outdated.');
    }

    const { userId, accountSeq, userSeq, homeSeq } = json as NavienUser;
    if (!userId || !accountSeq || !userSeq || !homeSeq) {
      throw new Error('Invalid JSON for NavienUser');
    }

    return new NavienUser(userId, accountSeq, userSeq, homeSeq);
  }
}
