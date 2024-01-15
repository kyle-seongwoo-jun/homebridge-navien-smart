export class NavienUser {
  constructor(
    readonly userId: string,
    readonly accountSeq: number,
    readonly userSeq: number,
    readonly familySeq: number,
  ) {
  }
}
