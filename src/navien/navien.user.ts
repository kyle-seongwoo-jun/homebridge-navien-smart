export class NavienUser {
  constructor(
    readonly userId: string,
    readonly accountSeq: number,
    readonly userSeq: number,
    readonly familySeq: number,
  ) {
  }

  static fromJSON(json: unknown): NavienUser {
    if (typeof json !== 'object' || json === null) {
      throw new Error('Invalid JSON for NavienUser');
    }

    const { userId, accountSeq, userSeq, familySeq } = json as NavienUser;
    if (!userId || !accountSeq || !userSeq || !familySeq) {
      throw new Error('Invalid JSON for NavienUser');
    }

    return new NavienUser(userId, accountSeq, userSeq, familySeq);
  }
}
